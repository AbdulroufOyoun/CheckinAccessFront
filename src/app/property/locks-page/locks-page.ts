import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SnackbarService } from '../../services/snackbar.service';
import {
  LockableType,
  PropLock,
  PropertyApiService,
} from '../services/property-api.service';
import {
  PropertyEntityDialog,
  PropertyEntityDialogData,
} from '../dialogs/property-entity-dialog/property-entity-dialog';
import { LinkEntitiesToLockDialog } from '../dialogs/link-entities-to-lock-dialog/link-entities-to-lock-dialog';

type LinkedEntityRow = { type: LockableType; id: number; label: string };

@Component({
  selector: 'app-locks-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './locks-page.html',
  styleUrl: './locks-page.css',
})
export class LocksPage implements OnInit {
  private readonly api = inject(PropertyApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  isRTL = false;
  loading = false;
  search = '';
  view: 'list' | 'linked' = 'list';
  selected: (PropLock & { linkedEntitiesCount?: number }) | null = null;
  selectedDetailTab: 'overview' | 'linked' = 'overview';

  locks: PropLock[] = [];
  filteredLocks: PropLock[] = [];

  linkedEntities: LinkedEntityRow[] = [];
  linkedLoading = false;

  private loadPromise: Promise<void> | null = null;
  private linkedLoadToken = 0;

  get stats(): { total: number; lowBattery: number; withGateway: number; linkedCount: number } {
    let lowBattery = 0;
    let withGateway = 0;
    let linkedCount = 0;
    for (const l of this.locks) {
      if (l.electricQuantity != null && l.electricQuantity < 30) lowBattery++;
      if (l.hasGateway) withGateway++;
      if (this.isLinked(l)) linkedCount++;
    }
    return {
      total: this.locks.length,
      lowBattery,
      withGateway,
      linkedCount,
    };
  }

  get linkedTabCount(): number {
    if (this.linkedEntities.length) return this.linkedEntities.length;
    if (this.selected?.linkedEntitiesCount != null) return this.selected.linkedEntitiesCount;
    if (this.selected) return this.linkCount(this.selected);
    return 0;
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        this.isRTL = e.lang === 'ar';
        this.cdr.detectChanges();
      });
    void this.load();
  }

  load(force = false): Promise<void> {
    if (!force && this.loadPromise) {
      return this.loadPromise;
    }
    this.loading = true;
    this.loadPromise = (async () => {
      try {
        this.locks = await this.api.listLocks(force);
        this.applyFilter();
        this.syncSelectedFromList();
      } catch (e: unknown) {
        this.snackbar.show(this.err(e), 'error');
      } finally {
        this.loading = false;
        this.loadPromise = null;
        this.cdr.detectChanges();
      }
    })();
    return this.loadPromise;
  }

  private syncSelectedFromList(): void {
    if (!this.selected) return;
    const fresh = this.locks.find((l) => l.id === this.selected!.id);
    if (!fresh) {
      this.selected = null;
      this.linkedEntities = [];
      return;
    }
    const count = this.selected.linkedEntitiesCount;
    this.selected = { ...fresh, linkedEntitiesCount: count ?? this.linkCount(fresh) };
  }

  private linkCount(l: PropLock): number {
    const fromApi =
      (l.buildings_count ?? 0) +
      (l.floors_count ?? 0) +
      (l.suites_count ?? 0) +
      (l.rooms_count ?? 0) +
      (l.facilities_count ?? 0) +
      (l.gates_count ?? 0) +
      (l.parkings_count ?? 0) +
      (l.elevators_count ?? 0);
    if (fromApi > 0) return fromApi;
    return (
      (l.linkedBuildings?.length ?? 0) +
      (l.linkedRooms?.length ?? 0) +
      (l.linkedFacilities?.length ?? 0)
    );
  }

  lockIsLinked(l: PropLock): boolean {
    return this.isLinked(l);
  }

  private isLinked(l: PropLock): boolean {
    return this.linkCount(l) > 0;
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    let base = this.locks;
    if (this.view === 'linked') {
      base = this.locks.filter((l) => this.isLinked(l));
    }
    if (!q) {
      this.filteredLocks = base;
      return;
    }
    this.filteredLocks = base.filter((l) =>
      [
        l.lockName,
        l.lockAlias,
        l.lockId != null ? String(l.lockId) : '',
        l.lockMac,
        String(l.id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }

  typeLabel(type: LockableType | string): string {
    const map: Record<string, string> = {
      building: 'PROP_BUILDING',
      floor: 'PROP_FLOOR',
      suite: 'PROP_SUITE',
      room: 'PROP_ROOM',
      facility: 'PROP_FACILITY',
      gate: 'PROP_GATE',
      parking: 'PROP_PARKING',
      elevator: 'PROP_ELEVATOR',
    };
    const key = map[type];
    return key ? this.translate.instant(key) : String(type);
  }

  typeTone(type: string): string {
    switch (type) {
      case 'building':
        return 'building';
      case 'floor':
        return 'floor';
      case 'suite':
        return 'suite';
      case 'room':
        return 'room';
      case 'facility':
        return 'facility';
      case 'gate':
        return 'gate';
      case 'parking':
        return 'parking';
      case 'elevator':
        return 'elevator';
      default:
        return 'default';
    }
  }

  showList(): void {
    this.view = 'list';
    this.selectedDetailTab = 'overview';
    this.applyFilter();
  }

  showLinked(): void {
    this.view = 'linked';
    this.applyFilter();
  }

  batteryTone(qty: number | undefined): string {
    if (qty == null) return 'default';
    if (qty < 20) return 'danger';
    if (qty < 50) return 'warning';
    return 'success';
  }

  select(lock: PropLock): void {
    this.linkedLoadToken++;
    this.selected = { ...lock, linkedEntitiesCount: this.linkCount(lock) };
    this.view = 'list';
    this.selectedDetailTab = 'overview';
    this.linkedEntities = [];
    void this.loadLinkedForSelected();
  }

  setDetailTab(tab: 'overview' | 'linked'): void {
    this.selectedDetailTab = tab;
    if (tab === 'linked') {
      void this.loadLinkedForSelected();
    }
  }

  private loadLinkedForSelected(): Promise<void> {
    if (!this.selected) return Promise.resolve();
    const lockId = this.selected.id;
    const token = ++this.linkedLoadToken;
    this.linkedLoading = true;
    return (async () => {
      try {
        const full = await this.api.getLock(lockId);
        if (token !== this.linkedLoadToken || this.selected?.id !== lockId) return;
        const tree = await this.api.loadTree({ allowStale: true });
        if (token !== this.linkedLoadToken || this.selected?.id !== lockId) return;

        const out: LinkedEntityRow[] = [];

        (full.buildings || []).forEach(({ id }) => {
          const b = tree.buildings.find((x) => x.id === id);
          out.push({ type: 'building', id, label: b?.name || `Building #${id}` });
        });

        (full.floors || []).forEach(({ id }) => {
          for (const b of tree.buildings) {
            const f = (b.floors || []).find((x) => x.id === id);
            if (f) {
              out.push({
                type: 'floor',
                id,
                label: `${b.name} · ${this.translate.instant('PROP_FLOOR')} ${f.number}`,
              });
              break;
            }
          }
        });

        (full.suites || []).forEach(({ id }) => {
          for (const b of tree.buildings) {
            for (const fl of b.floors || []) {
              const s = (fl.suites || []).find((x) => x.id === id);
              if (s) {
                out.push({
                  type: 'suite',
                  id,
                  label: `${b.name} · ${this.translate.instant('PROP_SUITE')} ${s.number}`,
                });
                return;
              }
            }
          }
        });

        (full.rooms || []).forEach(({ id }) => {
          let found = false;
          for (const b of tree.buildings) {
            for (const f of b.floors || []) {
              const r = (f.rooms || []).find((x) => x.id === id);
              if (r) {
                out.push({ type: 'room', id, label: r.name || `Room ${r.number}` });
                found = true;
                break;
              }
              for (const s of f.suites || []) {
                const sr = (s.rooms || []).find((x) => x.id === id);
                if (sr) {
                  out.push({ type: 'room', id, label: sr.name || `Room ${sr.number}` });
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
            if (found) break;
          }
          if (!found) {
            out.push({ type: 'room', id, label: `Room #${id}` });
          }
        });

        (full.facilities || []).forEach(({ id }) => {
          const f = tree.facilities.find((x) => x.id === id);
          out.push({ type: 'facility', id, label: f?.name || `Facility #${id}` });
        });

        (full.gates || []).forEach(({ id }) => {
          const g = tree.gates.find((x) => x.id === id);
          out.push({ type: 'gate', id, label: g?.name || `Gate #${id}` });
        });

        (full.parkings || []).forEach(({ id }) => {
          const p = tree.parkings.find((x) => x.id === id);
          out.push({ type: 'parking', id, label: p?.name || `Parking #${id}` });
        });

        (full.elevators || []).forEach(({ id }) => {
          const e = tree.elevators.find((x) => x.id === id);
          out.push({ type: 'elevator', id, label: e?.name || `Elevator #${id}` });
        });

        this.linkedEntities = out;
        if (this.selected?.id === lockId) {
          this.selected.linkedEntitiesCount = out.length;
        }
      } catch (e: unknown) {
        if (token === this.linkedLoadToken) {
          this.snackbar.show(this.err(e), 'error');
        }
      } finally {
        if (token === this.linkedLoadToken) {
          this.linkedLoading = false;
          this.cdr.detectChanges();
        }
      }
    })();
  }

  openAddLock(): void {
    const ref = this.dialog.open(PropertyEntityDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '480px',
      maxWidth: '94vw',
      data: {
        entity: 'lock',
        mode: 'add',
      } satisfies PropertyEntityDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.load(true);
    });
  }

  openEditLock(): void {
    if (!this.selected) return;
    const ref = this.dialog.open(PropertyEntityDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '480px',
      maxWidth: '94vw',
      data: {
        entity: 'lock',
        mode: 'edit',
        item: { ...this.selected },
      } satisfies PropertyEntityDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.load(true);
    });
  }

  async deleteLock(): Promise<void> {
    if (!this.selected) return;
    const ok = confirm(
      this.translate.instant('LOCKS_DELETE_CONFIRM', {
        name: this.selected.lockName || this.selected.lockAlias || `#${this.selected.id}`,
      }),
    );
    if (!ok) return;
    try {
      await this.api.deleteLock(this.selected.id);
      this.snackbar.show(this.translate.instant('LOCKS_DELETED'), 'success');
      this.selected = null;
      this.linkedEntities = [];
      await this.load(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  openLinkEntities(): void {
    if (!this.selected) return;
    const lockId = this.selected.id;
    const ref = this.dialog.open(LinkEntitiesToLockDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '520px',
      maxWidth: '94vw',
      data: { lockId },
    });
    ref.afterClosed().subscribe((saved) => {
      if (!saved) return;
      void this.load(true).then(() => {
        if (this.selected?.id === lockId) {
          this.linkedEntities = [];
          void this.loadLinkedForSelected();
        }
      });
    });
  }

  async unlinkEntity(entity: { type: LockableType; id: number }): Promise<void> {
    if (!this.selected) return;
    try {
      await this.api.unlinkLock(entity.type, entity.id, this.selected.id);
      this.snackbar.show(this.translate.instant('LOCKS_UNLINKED'), 'success');
      await this.load(true);
      if (this.selected) {
        this.linkedEntities = [];
        await this.loadLinkedForSelected();
      }
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private t(key: string): string {
    return this.translate.instant(key);
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.t('REQUEST_FAILED');
  }

  trackLock(_: number, l: PropLock): number {
    return l.id;
  }
}
