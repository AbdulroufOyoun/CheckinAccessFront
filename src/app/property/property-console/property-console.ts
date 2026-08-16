import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../../services/snackbar.service';
import { PropertyTreeCache } from '../../services/property-tree-cache.service';
import {
  LockableType,
  PropBuilding,
  PropElevator,
  PropFacility,
  PropFloor,
  PropGate,
  PropLock,
  PropNodeType,
  PropParking,
  PropRoom,
  PropSuite,
  PropTreeSnapshot,
  PropType,
  PropertyApiService,
} from '../services/property-api.service';
import {
  PropertyEntityDialog,
  PropertyEntityDialogData,
} from '../dialogs/property-entity-dialog/property-entity-dialog';
import { LinkLockDialog } from '../dialogs/link-lock-dialog/link-lock-dialog';

export interface TreeNode {
  key: string;
  type: PropNodeType;
  id: number;
  label: string;
  meta?: string;
  active?: boolean;
  children?: TreeNode[];
  raw: Record<string, unknown>;
}

type DetailTab = 'overview' | 'locks' | 'catalogs';

@Component({
  selector: 'app-property-console',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton, NgTemplateOutlet],
  templateUrl: './property-console.html',
  styleUrl: './property-console.css',
})
export class PropertyConsole implements OnInit {
  private readonly api = inject(PropertyApiService);
  private readonly treeCache = inject(PropertyTreeCache);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);

  isRTL = false;
  loading = false;
  initialLoad = true;
  search = '';
  view: 'tree' | 'catalogs' = 'tree';
  detailTab: DetailTab = 'overview';
  highlightLockId: number | null = null;
  private deepLinkApplied = false;

  snapshot: PropTreeSnapshot | null = null;
  tree: TreeNode[] = [];
  filteredTree: TreeNode[] = [];
  expanded = new Set<string>();
  selected: TreeNode | null = null;

  linkedLocks: PropLock[] = [];
  allLocks: PropLock[] = [];
  locksLoading = false;

  get showSkeleton(): boolean {
    return this.initialLoad && !this.snapshot;
  }

  get stats(): { compounds: number; buildings: number; floors: number; rooms: number } {
    const buildings = this.snapshot?.buildings || [];
    let floors = 0;
    let rooms = 0;
    for (const b of buildings) {
      for (const f of b.floors || []) {
        floors++;
        rooms += (f.rooms || []).length;
        for (const s of f.suites || []) {
          rooms += (s.rooms || []).length;
        }
      }
    }
    return {
      compounds: this.snapshot?.compounds?.length || 0,
      buildings: buildings.length,
      floors,
      rooms,
    };
  }

  showTree(): void {
    this.view = 'tree';
    this.detailTab = 'overview';
  }

  expandAll(): void {
    for (const n of this.flat(this.filteredTree)) {
      if (n.children?.length) this.expanded.add(n.key);
    }
  }

  collapseAll(): void {
    this.expanded.clear();
  }

  typeTone(type: PropNodeType | string): string {
    const map: Record<string, string> = {
      compound: 'compound',
      building: 'building',
      floor: 'floor',
      suite: 'suite',
      room: 'room',
      facility: 'facility',
      gate: 'gate',
      parking: 'parking',
      elevator: 'elevator',
    };
    return map[type] || 'default';
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    void this.load();
  }

  async load(keepSelection = true, quiet = false, force = false): Promise<void> {
    const prevKey = keepSelection ? this.selected?.key : null;
    const cached = this.treeCache.peekPropertyPageBundle();
    if (!quiet && !cached && !this.snapshot) {
      this.loading = true;
    }
    try {
      this.snapshot = await this.api.loadTree({
        force,
        allowStale: !force,
      });
      this.tree = this.buildTree(this.snapshot);
      this.applyFilter();
      if (prevKey) {
        this.selected = this.findNode(this.tree, prevKey);
        this.expandAncestors(prevKey);
        if (this.selected && this.detailTab === 'locks') {
          void this.loadLocksForSelected();
        }
      } else if (!this.selected) {
        this.expandDefaults();
      }
      if (!this.deepLinkApplied) {
        await this.applyDeepLink();
        this.deepLinkApplied = true;
      }
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  private async applyDeepLink(): Promise<void> {
    const q = this.route.snapshot.queryParamMap;
    const type = q.get('type') as PropNodeType | null;
    const id = Number(q.get('id') || 0);
    const lockId = Number(q.get('lock') || 0) || null;
    const tab = q.get('tab');

    this.highlightLockId = lockId;

    if (type && id) {
      await this.focusNode(type, id, tab === 'locks');
      return;
    }

    if (!lockId) return;

    try {
      const lock = await this.api.getLock(lockId);
      const roomId = lock.rooms?.[0]?.id;
      const buildingId = lock.buildings?.[0]?.id;
      const facilityId = lock.facilities?.[0]?.id;
      if (roomId) {
        await this.focusNode('room', roomId, true);
      } else if (buildingId) {
        await this.focusNode('building', buildingId, true);
      } else if (facilityId) {
        await this.focusNode('facility', facilityId, true);
      }
    } catch {
      /* ignore deep-link failures */
    }
  }

  private async focusNode(type: PropNodeType, id: number, openLocks: boolean): Promise<void> {
    const key = `${type}-${id}`;
    const node = this.findNode(this.tree, key);
    if (!node) return;
    this.expandAncestors(key);
    this.selected = node;
    this.view = 'tree';
    if (openLocks && this.canLinkLocks) {
      this.detailTab = 'locks';
      await this.loadLocksForSelected();
    } else {
      this.detailTab = 'overview';
    }
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    if (!q) {
      this.filteredTree = this.tree;
      return;
    }
    this.filteredTree = this.filterNodes(this.tree, q);
    for (const n of this.flat(this.filteredTree)) {
      this.expanded.add(n.key);
    }
  }

  private filterNodes(nodes: TreeNode[], q: string): TreeNode[] {
    const out: TreeNode[] = [];
    for (const n of nodes) {
      const kids = n.children ? this.filterNodes(n.children, q) : [];
      const hit =
        n.label.toLowerCase().includes(q) ||
        (n.meta || '').toLowerCase().includes(q) ||
        n.type.includes(q);
      if (hit || kids.length) {
        out.push({ ...n, children: kids.length ? kids : n.children });
      }
    }
    return out;
  }

  private flat(nodes: TreeNode[]): TreeNode[] {
    return nodes.flatMap((n) => [n, ...(n.children ? this.flat(n.children) : [])]);
  }

  private findNode(nodes: TreeNode[], key: string): TreeNode | null {
    for (const n of nodes) {
      if (n.key === key) return n;
      if (n.children) {
        const f = this.findNode(n.children, key);
        if (f) return f;
      }
    }
    return null;
  }

  expandAncestors(key: string): void {
    const walk = (nodes: TreeNode[], parents: string[]): boolean => {
      for (const n of nodes) {
        if (n.key === key) {
          for (const p of parents) this.expanded.add(p);
          this.expanded.add(n.key);
          return true;
        }
        if (n.children?.length && walk(n.children, [...parents, n.key])) return true;
      }
      return false;
    };
    walk(this.tree, []);
  }

  private expandDefaults(): void {
    for (const n of this.tree.slice(0, 5)) {
      this.expanded.add(n.key);
      for (const child of n.children || []) {
        if (child.type === 'building') this.expanded.add(child.key);
      }
    }
  }

  private buildTree(s: PropTreeSnapshot): TreeNode[] {
    const facilitiesByFloor = new Map<number, PropFacility[]>();
    for (const f of s.facilities) {
      const list = facilitiesByFloor.get(f.floor_id) || [];
      list.push(f);
      facilitiesByFloor.set(f.floor_id, list);
    }

    const elevatorsByBuilding = new Map<number, PropElevator[]>();
    for (const e of s.elevators) {
      const list = elevatorsByBuilding.get(e.building_id) || [];
      list.push(e);
      elevatorsByBuilding.set(e.building_id, list);
    }

    const gatesByCompound = new Map<number, PropGate[]>();
    const gatesByBuilding = new Map<number, PropGate[]>();
    for (const g of s.gates) {
      const c = gatesByCompound.get(g.compound_id) || [];
      c.push(g);
      gatesByCompound.set(g.compound_id, c);
      const b = gatesByBuilding.get(g.building_id) || [];
      b.push(g);
      gatesByBuilding.set(g.building_id, b);
    }

    const parkingsByCompound = new Map<number, PropParking[]>();
    const parkingsByBuilding = new Map<number, PropParking[]>();
    for (const p of s.parkings) {
      if (p.compound_id) {
        const c = parkingsByCompound.get(p.compound_id) || [];
        c.push(p);
        parkingsByCompound.set(p.compound_id, c);
      }
      if (p.building_id) {
        const b = parkingsByBuilding.get(p.building_id) || [];
        b.push(p);
        parkingsByBuilding.set(p.building_id, b);
      }
    }

    const buildFloor = (floor: PropFloor, building: PropBuilding): TreeNode => {
      const suites = (floor.suites || []).map((suite) => this.suiteNode(suite, floor, building));
      const rooms = (floor.rooms || [])
        .filter((r) => !r.suite_id)
        .map((r) => this.roomNode(r, floor, building));
      const facs = (facilitiesByFloor.get(floor.id) || floor.facilities || []).map((f) =>
        this.facilityNode(f, floor, building),
      );
      return {
        key: `floor-${floor.id}`,
        type: 'floor',
        id: floor.id,
        label: `${this.t('PROP_FLOOR')} ${floor.number}`,
        meta: building.name,
        active: floor.active,
        raw: { ...floor, building_id: building.id, compound_id: building.compound_id },
        children: [...suites, ...rooms, ...facs],
      };
    };

    const buildBuilding = (b: PropBuilding): TreeNode => {
      const floors = (b.floors || []).map((f) => buildFloor(f, b));
      const elevators = (elevatorsByBuilding.get(b.id) || b.elevators || []).map((e) =>
        this.elevatorNode(e, b),
      );
      const gates = (gatesByBuilding.get(b.id) || []).map((g) => this.gateNode(g));
      const parkings = (parkingsByBuilding.get(b.id) || b.parkings || []).map((p) =>
        this.parkingNode(p),
      );
      return {
        key: `building-${b.id}`,
        type: 'building',
        id: b.id,
        label: b.name,
        meta: b.number ? `#${b.number}` : undefined,
        active: b.active,
        raw: { ...b },
        children: [...floors, ...elevators, ...gates, ...parkings],
      };
    };

    const roots: TreeNode[] = [];
    const linkedBuildingIds = new Set<number>();

    for (const c of s.compounds) {
      const buildings = s.buildings
        .filter((b) => Number(b.compound_id) === Number(c.id))
        .map((b) => {
          linkedBuildingIds.add(b.id);
          return buildBuilding(b);
        });
      const gates = (gatesByCompound.get(c.id) || []).map((g) => this.gateNode(g));
      const parkings = (parkingsByCompound.get(c.id) || []).map((p) => this.parkingNode(p));
      roots.push({
        key: `compound-${c.id}`,
        type: 'compound',
        id: c.id,
        label: c.name,
        meta: c.number ? `#${c.number}` : undefined,
        active: c.active,
        raw: { ...c },
        children: [...buildings, ...gates, ...parkings],
      });
    }

    const orphanBuildings = s.buildings.filter((b) => !linkedBuildingIds.has(b.id));
    if (orphanBuildings.length) {
      roots.push({
        key: 'orphan-buildings',
        type: 'compound',
        id: 0,
        label: this.t('PROP_UNASSIGNED'),
        meta: String(orphanBuildings.length),
        raw: { virtual: true },
        children: orphanBuildings.map(buildBuilding),
      });
    }

    return roots;
  }

  private suiteNode(suite: PropSuite, floor: PropFloor, building: PropBuilding): TreeNode {
    return {
      key: `suite-${suite.id}`,
      type: 'suite',
      id: suite.id,
      label: suite.name || `${this.t('PROP_SUITE')} ${suite.number}`,
      meta: `#${suite.number}`,
      active: suite.active,
      raw: { ...suite, floor_id: floor.id, building_id: building.id, compound_id: building.compound_id },
      children: (suite.rooms || []).map((r) => this.roomNode(r, floor, building, suite)),
    };
  }

  private roomNode(
    room: PropRoom,
    floor: PropFloor,
    building: PropBuilding,
    suite?: PropSuite,
  ): TreeNode {
    const typeName = room.room_type?.name || room.roomType?.name;
    return {
      key: `room-${room.id}`,
      type: 'room',
      id: room.id,
      label: room.name || `${this.t('PROP_ROOM')} ${room.number}`,
      meta: typeName || `#${room.number}`,
      active: room.active,
      raw: {
        ...room,
        floor_id: room.floor_id ?? floor.id,
        building_id: room.building_id ?? building.id,
        suite_id: room.suite_id ?? suite?.id ?? null,
        compound_id: building.compound_id,
      },
    };
  }

  private facilityNode(f: PropFacility, floor: PropFloor, building: PropBuilding): TreeNode {
    return {
      key: `facility-${f.id}`,
      type: 'facility',
      id: f.id,
      label: f.name,
      meta: f.facilitie_type?.name,
      active: f.active,
      raw: {
        ...f,
        floor_id: f.floor_id || floor.id,
        building_id: building.id,
        compound_id: building.compound_id,
        facilitie_type_id: f.facilitie_type_id || f.facility_type_id,
      },
    };
  }

  private gateNode(g: PropGate): TreeNode {
    return {
      key: `gate-${g.id}`,
      type: 'gate',
      id: g.id,
      label: g.name,
      meta: g.direction,
      raw: { ...g },
    };
  }

  private parkingNode(p: PropParking): TreeNode {
    return {
      key: `parking-${p.id}`,
      type: 'parking',
      id: p.id,
      label: p.name,
      meta: p.location || (p.capacity != null ? String(p.capacity) : undefined),
      raw: { ...p },
    };
  }

  private elevatorNode(e: PropElevator, building: PropBuilding): TreeNode {
    return {
      key: `elevator-${e.id}`,
      type: 'elevator',
      id: e.id,
      label: e.name,
      meta: e.capacity != null ? String(e.capacity) : undefined,
      raw: { ...e, building_id: building.id, compound_id: building.compound_id },
    };
  }

  private t(key: string): string {
    return this.translate.instant(key);
  }

  toggle(node: TreeNode, event?: Event): void {
    event?.stopPropagation();
    if (!node.children?.length) return;
    if (this.expanded.has(node.key)) this.expanded.delete(node.key);
    else this.expanded.add(node.key);
  }

  isExpanded(node: TreeNode): boolean {
    return this.expanded.has(node.key);
  }

  select(node: TreeNode): void {
    if (node.id === 0 && node.raw['virtual']) return;
    this.selected = node;
    this.view = 'tree';
    this.detailTab = 'overview';
    this.linkedLocks = [];
    this.cdr.detectChanges();
  }

  showCatalogs(): void {
    this.view = 'catalogs';
    this.selected = null;
    this.detailTab = 'catalogs';
    void this.ensureCatalogTypes();
  }

  private async ensureCatalogTypes(): Promise<void> {
    if (!this.snapshot) return;
    const needRooms = !(this.snapshot.roomTypes?.length);
    const needFacilities = !(this.snapshot.facilityTypes?.length);
    if (!needRooms && !needFacilities) return;
    try {
      const types = await this.api.loadCatalogTypes();
      if (needRooms) this.snapshot.roomTypes = types.roomTypes;
      if (needFacilities) this.snapshot.facilityTypes = types.facilityTypes;
      this.cdr.detectChanges();
    } catch {
      /* keep existing snapshot types */
    }
  }

  typeLabel(type: PropNodeType): string {
    const map: Record<PropNodeType, string> = {
      compound: 'PROP_COMPOUND',
      building: 'PROP_BUILDING',
      floor: 'PROP_FLOOR',
      suite: 'PROP_SUITE',
      room: 'PROP_ROOM',
      facility: 'PROP_FACILITY',
      gate: 'PROP_GATE',
      parking: 'PROP_PARKING',
      elevator: 'PROP_ELEVATOR',
      room_type: 'PROP_ROOM_TYPE',
      facility_type: 'PROP_FACILITY_TYPE',
      lock: 'LOCKS_LOCK',
    };
    return this.t(map[type] || type);
  }

  get canActivate(): boolean {
    return !!this.selected && ['compound', 'building', 'floor', 'suite', 'room', 'facility'].includes(this.selected.type);
  }

  get canLinkLocks(): boolean {
    return (
      !!this.selected &&
      ['building', 'floor', 'suite', 'room', 'facility', 'gate', 'parking', 'elevator'].includes(
        this.selected.type,
      )
    );
  }

  get addActions(): Array<{ entity: PropNodeType; labelKey: string }> {
    if (!this.selected) {
      return [{ entity: 'compound', labelKey: 'PROP_ADD_COMPOUND' }];
    }
    switch (this.selected.type) {
      case 'compound':
        return [
          { entity: 'building', labelKey: 'PROP_ADD_BUILDING' },
          { entity: 'gate', labelKey: 'PROP_ADD_GATE' },
          { entity: 'parking', labelKey: 'PROP_ADD_PARKING' },
        ];
      case 'building':
        return [
          { entity: 'floor', labelKey: 'PROP_ADD_FLOOR' },
          { entity: 'elevator', labelKey: 'PROP_ADD_ELEVATOR' },
          { entity: 'gate', labelKey: 'PROP_ADD_GATE' },
          { entity: 'parking', labelKey: 'PROP_ADD_PARKING' },
        ];
      case 'floor':
        return [
          { entity: 'suite', labelKey: 'PROP_ADD_SUITE' },
          { entity: 'room', labelKey: 'PROP_ADD_ROOM' },
          { entity: 'facility', labelKey: 'PROP_ADD_FACILITY' },
        ];
      case 'suite':
        return [{ entity: 'room', labelKey: 'PROP_ADD_ROOM' }];
      default:
        return [];
    }
  }

  childSummary(): Array<{ label: string; count: number }> {
    if (!this.selected?.children) return [];
    const counts = new Map<string, number>();
    for (const c of this.selected.children) {
      counts.set(c.type, (counts.get(c.type) || 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({
      label: this.typeLabel(type as PropNodeType),
      count,
    }));
  }

  openAdd(entity: PropNodeType): void {
    const parent = this.parentContext(entity);
    this.openEntityDialog({ entity, mode: 'add', parent });
  }

  openEdit(): void {
    if (!this.selected || this.selected.raw['virtual']) return;
    this.openEntityDialog({
      entity: this.selected.type,
      mode: 'edit',
      item: { ...this.selected.raw, id: this.selected.id },
      parent: this.parentContext(this.selected.type),
    });
  }

  private parentContext(entity: PropNodeType): PropertyEntityDialogData['parent'] {
    const s = this.selected;
    if (!s) return {};
    const r = s.raw;
    const base = {
      compound_id: Number(r['compound_id'] || (s.type === 'compound' ? s.id : 0)) || undefined,
      building_id: Number(r['building_id'] || (s.type === 'building' ? s.id : 0)) || undefined,
      floor_id: Number(r['floor_id'] || (s.type === 'floor' ? s.id : 0)) || undefined,
      suite_id: Number(r['suite_id'] || (s.type === 'suite' ? s.id : 0)) || undefined,
    };
    if (entity === 'building' && s.type === 'compound') base.compound_id = s.id;
    if (entity === 'floor' && s.type === 'building') base.building_id = s.id;
    if ((entity === 'suite' || entity === 'room' || entity === 'facility') && s.type === 'floor') {
      base.floor_id = s.id;
      base.building_id = Number(r['building_id']) || undefined;
    }
    if (entity === 'room' && s.type === 'suite') {
      base.suite_id = s.id;
      base.floor_id = Number(r['floor_id']) || undefined;
      base.building_id = Number(r['building_id']) || undefined;
    }
    if ((entity === 'gate' || entity === 'parking') && s.type === 'compound') {
      base.compound_id = s.id;
    }
    if ((entity === 'gate' || entity === 'parking' || entity === 'elevator') && s.type === 'building') {
      base.building_id = s.id;
      base.compound_id = Number(r['compound_id']) || undefined;
    }
    return base;
  }

  private suitesForFloor(floorId: number | null): Array<{ id: number; name?: string; number?: string; floor_id?: number }> {
    if (!floorId || !this.snapshot?.buildings) return [];
    for (const b of this.snapshot.buildings) {
      for (const f of b.floors || []) {
        if (f.id === floorId) {
          return (f.suites || []).map((s) => ({
            id: s.id,
            name: s.name,
            number: String(s.number),
            floor_id: s.floor_id,
          }));
        }
      }
    }
    return [];
  }

  private openEntityDialog(data: Partial<PropertyEntityDialogData> & { entity: PropNodeType; mode: 'add' | 'edit' }): void {
    const compounds = (this.snapshot?.compounds || []).map((c) => ({ id: c.id, name: c.name }));
    const buildings = (this.snapshot?.buildings || []).map((b) => ({
      id: b.id,
      name: b.name,
      compound_id: b.compound_id,
    }));
    const floorId = Number(data.parent?.floor_id || data.item?.['floor_id'] || 0) || null;
    const suites = this.suitesForFloor(floorId);
    const ref = this.dialog.open(PropertyEntityDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '480px',
      maxWidth: '94vw',
      data: {
        ...data,
        roomTypes: this.snapshot?.roomTypes || [],
        facilityTypes: this.snapshot?.facilityTypes || [],
        compounds,
        buildings,
        suites,
      } satisfies PropertyEntityDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.load(true, true, true);
    });
  }

  async toggleActive(): Promise<void> {
    if (!this.selected || !this.canActivate) return;
    const active = this.selected.active !== false;
    const id = this.selected.id;
    try {
      switch (this.selected.type) {
        case 'compound':
          await (active ? this.api.inactivateCompound(id) : this.api.activateCompound(id));
          break;
        case 'building':
          await (active ? this.api.inactivateBuilding(id) : this.api.activateBuilding(id));
          break;
        case 'floor':
          await (active ? this.api.inactivateFloor(id) : this.api.activateFloor(id));
          break;
        case 'suite':
          await (active ? this.api.inactivateSuite(id) : this.api.activateSuite(id));
          break;
        case 'room':
          await (active ? this.api.inactivateRoom(id) : this.api.activateRoom(id));
          break;
        case 'facility':
          await (active ? this.api.inactivateFacility(id) : this.api.activateFacility(id));
          break;
      }
      this.snackbar.show(this.t('PROP_SAVED'), 'success');
      await this.load(true, true, true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async removeSelected(): Promise<void> {
    if (!this.selected || this.selected.raw['virtual']) return;
    const ok = confirm(
      this.translate.instant('PROP_DELETE_CONFIRM', {
        type: this.typeLabel(this.selected.type),
        name: this.selected.label,
      }),
    );
    if (!ok) return;
    const id = this.selected.id;
    try {
      switch (this.selected.type) {
        case 'compound':
          await this.api.deleteCompound(id);
          break;
        case 'building':
          await this.api.deleteBuilding(id);
          break;
        case 'floor':
          await this.api.deleteFloor(id);
          break;
        case 'suite':
          await this.api.deleteSuite(id);
          break;
        case 'room':
          await this.api.deleteRoom(id);
          break;
        case 'facility':
          await this.api.deleteFacility(id);
          break;
        case 'gate':
          await this.api.deleteGate(id);
          break;
        case 'parking':
          await this.api.deleteParking(id);
          break;
        case 'elevator':
          await this.api.deleteElevator(id);
          break;
        default:
          return;
      }
      this.selected = null;
      this.snackbar.show(this.t('PROP_DELETED'), 'success');
      await this.load(false, true, true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  setDetailTab(tab: DetailTab): void {
    this.detailTab = tab;
    if (tab === 'locks' && this.canLinkLocks) {
      void this.loadLocksForSelected();
    }
  }

  async loadLocksForSelected(): Promise<void> {
    if (!this.selected || !this.canLinkLocks) return;
    this.locksLoading = true;
    try {
      const type = this.selected.type as LockableType;
      const [linked, all] = await Promise.all([
        this.api.getPropertyLocks(type, this.selected.id),
        this.allLocks.length ? Promise.resolve(this.allLocks) : this.api.listLocks(),
      ]);
      this.linkedLocks = linked;
      this.allLocks = all;
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.locksLoading = false;
      this.cdr.detectChanges();
    }
  }

  openLinkLocks(): void {
    if (!this.selected || !this.canLinkLocks) return;
    const type = this.selected.type as LockableType;
    const open = (available: PropLock[], linked: PropLock[]) => {
      const ref = this.dialog.open(LinkLockDialog, {
        panelClass: ['custom-dialog', 'subject-dialog'],
        backdropClass: 'custom-backdrop',
        width: '480px',
        maxWidth: '94vw',
        data: {
          propertyType: type,
          propertyId: this.selected!.id,
          linked,
          available,
        },
      });
      ref.afterClosed().subscribe((saved) => {
        if (saved) void this.loadLocksForSelected();
      });
    };

    void (async () => {
      try {
        if (!this.allLocks.length) this.allLocks = await this.api.listLocks();
        if (!this.linkedLocks.length) {
          this.linkedLocks = await this.api.getPropertyLocks(type, this.selected!.id);
        }
        open(this.allLocks, this.linkedLocks);
      } catch (e: unknown) {
        this.snackbar.show(this.err(e), 'error');
      }
    })();
  }

  async unlinkOne(lock: PropLock): Promise<void> {
    if (!this.selected || !this.canLinkLocks) return;
    try {
      await this.api.unlinkLock(this.selected.type as LockableType, this.selected.id, lock.id);
      this.snackbar.show(this.t('PROP_LOCKS_UPDATED'), 'success');
      await this.loadLocksForSelected();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  // —— Catalogs ——
  get roomTypes(): PropType[] {
    return this.snapshot?.roomTypes || [];
  }
  get facilityTypes(): PropType[] {
    return this.snapshot?.facilityTypes || [];
  }

  openAddType(entity: 'room_type' | 'facility_type'): void {
    this.openEntityDialog({ entity, mode: 'add' });
  }

  openEditType(entity: 'room_type' | 'facility_type', item: PropType): void {
    this.openEntityDialog({ entity, mode: 'edit', item: { ...item } });
  }

  async deleteType(entity: 'room_type' | 'facility_type', item: PropType): Promise<void> {
    const ok = confirm(
      this.translate.instant('PROP_DELETE_CONFIRM', {
        type: this.typeLabel(entity),
        name: item.name,
      }),
    );
    if (!ok) return;
    try {
      if (entity === 'room_type') await this.api.deleteRoomType(item.id);
      else await this.api.deleteFacilityType(item.id);
      this.snackbar.show(this.t('PROP_DELETED'), 'success');
      await this.load(true, true, true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  field(key: string): unknown {
    return this.selected?.raw?.[key];
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.t('REQUEST_FAILED');
  }

  trackNode(_: number, n: TreeNode): string {
    return n.key;
  }
}
