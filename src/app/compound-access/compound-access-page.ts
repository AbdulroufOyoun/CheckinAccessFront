import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogMobileService } from '../services/dialog-mobile.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../services/snackbar.service';
import { ConfirmDialog } from '../dialog/confirm-dialog/confirm-dialog';
import {
  CompoundAccessRow,
  CompoundAccessUser,
  CompoundAccessService,
  PropertyAccessGrant,
  PropertyAccessGrantDisplay,
  PropertyAccessScopeType,
} from '../services/compound-access.service';
import { PropertyPageBundle } from '../services/property-tree-cache.service';

type TreeFloor = {
  id: number;
  number: number | string;
  building_id: number;
  suites?: TreeSuite[];
  rooms?: TreeRoom[];
  facilities?: TreeFacility[];
};

type TreeSuite = { id: number; number?: string | number; name?: string | null; floor_id?: number; rooms?: TreeRoom[] };
type TreeRoom = { id: number; number?: string | number; name?: string | null };
type TreeFacility = { id: number; name?: string | null };
type TreeBuilding = {
  id: number;
  name?: string;
  number?: string;
  compound_id?: number | null;
  floors?: TreeFloor[];
  parkings?: TreeParking[];
  elevators?: { id: number; name?: string }[];
};
type TreeParking = { id: number; name?: string; building_id?: number | null; compound_id?: number | null };
type TreeGate = { id: number; name?: string; compound_id?: number; building_id?: number | null };

@Component({
  selector: 'app-compound-access-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './compound-access-page.html',
  styleUrls: ['../education/education-shared.css', '../education/enrollments/enrollments-page.css', './compound-access-page.css'],
})
export class CompoundAccessPage implements OnInit {
  private readonly compoundAccess = inject(CompoundAccessService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogMobile = inject(DialogMobileService);

  @ViewChild('studentInput') private studentInput?: ElementRef<HTMLInputElement>;

  isRTL = false;
  loading = false;
  initialLoad = true;
  saving = false;
  rows: CompoundAccessRow[] = [];
  filter = '';

  dialogOpen = false;
  treeLoading = false;
  propertyTree: PropertyPageBundle | null = null;
  expandedCompounds = new Set<number>();

  editingUserId: number | null = null;
  studentQuery = '';
  studentHits: CompoundAccessUser[] = [];
  searchingStudents = false;
  studentMenuOpen = false;
  studentHighlight = 0;
  selectedStudent: CompoundAccessUser | null = null;
  selectedGrantKeys = new Set<string>();

  private studentSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private studentSearchGen = 0;

  get showSkeleton(): boolean {
    return this.initialLoad && this.rows.length === 0 && this.loading;
  }

  get filteredRows(): CompoundAccessRow[] {
    const q = this.filter.trim().toLowerCase();
    if (!q) {
      return this.rows;
    }
    const digits = q.replace(/\D+/g, '');
    return this.rows.filter((row) => {
      const name = String(row.user?.name || '').toLowerCase();
      const email = String(row.user?.email || '').toLowerCase();
      const mobile = String(row.user?.mobile || '').toLowerCase();
      const mobileDigits = mobile.replace(/\D+/g, '');
      const grants = (row.grants || []).map((g) => this.grantChipText(g)).join(' ').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        mobile.includes(q) ||
        (digits.length >= 3 && mobileDigits.includes(digits)) ||
        grants.includes(q)
      );
    });
  }

  get canSearchStudent(): boolean {
    return this.editingUserId == null;
  }

  get selectedCount(): number {
    return this.selectedGrantKeys.size;
  }

  get canSave(): boolean {
    if (this.saving) {
      return false;
    }
    if (!(this.selectedStudent?.id || this.editingUserId)) {
      return false;
    }
    if (this.editingUserId == null && this.selectedCount === 0) {
      return false;
    }
    return true;
  }

  get previewMark(): string {
    return this.initials(this.selectedStudent) || 'CA';
  }

  get previewTitle(): string {
    if (this.selectedStudent) {
      return this.selectedStudent.name || `#${this.selectedStudent.id}`;
    }
    return this.translate.instant('EDU_CA_PREVIEW_EMPTY');
  }

  get previewMeta(): string {
    if (this.selectedStudent) {
      return this.contactLabel(this.selectedStudent);
    }
    return this.translate.instant('EDU_CA_PREVIEW_READY');
  }

  get treeCompounds(): PropertyPageBundle['compounds'] {
    return (this.propertyTree?.compounds || []).filter((c) => c.active !== false);
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.destroyRef.onDestroy(() => {
      if (this.studentSearchTimer) {
        clearTimeout(this.studentSearchTimer);
      }
    });
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const rowsRes = await this.compoundAccess.list();
      this.rows = (Array.isArray(rowsRes.data) ? rowsRes.data : []).map((row) => ({
        ...row,
        grants: row.grants ?? [],
        grants_display: row.grants_display ?? row.grants ?? [],
        compounds: row.compounds ?? [],
      }));
    } catch {
      this.snackbar.show(this.translate.instant('EDU_CA_LOAD_FAILED'), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  async ensurePropertyTree(): Promise<void> {
    if (this.propertyTree || this.treeLoading) {
      return;
    }
    this.treeLoading = true;
    this.cdr.detectChanges();
    try {
      const res = await this.compoundAccess.loadPropertyTree();
      this.propertyTree = res.data ?? null;
    } catch {
      this.snackbar.show(this.translate.instant('EDU_CA_TREE_LOAD_FAILED'), 'error');
    } finally {
      this.treeLoading = false;
      this.cdr.detectChanges();
    }
  }

  openCreate(): void {
    this.editingUserId = null;
    this.selectedStudent = null;
    this.selectedGrantKeys = new Set();
    this.studentQuery = '';
    this.studentHits = [];
    this.studentMenuOpen = false;
    this.studentHighlight = 0;
    this.expandedCompounds = new Set();
    this.dialogOpen = true;
    void this.ensurePropertyTree();
    this.focusStudentInput();
  }

  openEdit(row: CompoundAccessRow): void {
    this.editingUserId = row.user_id;
    this.selectedStudent = row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          mobile: row.user.mobile,
        }
      : { id: row.user_id };
    this.selectedGrantKeys = new Set((row.grants || []).map((g) => this.grantKey(g.type, g.id)));
    this.studentQuery = this.studentLabel(this.selectedStudent);
    this.studentHits = [];
    this.studentMenuOpen = false;
    this.expandedCompounds = new Set(
      (row.grants || [])
        .map((g) => g.compound_id)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    );
    this.dialogOpen = true;
    void this.ensurePropertyTree();
  }

  closeDialog(): void {
    if (this.saving) {
      return;
    }
    this.dialogOpen = false;
    this.studentMenuOpen = false;
  }

  grantKey(type: string, id: number): string {
    return `${type}:${id}`;
  }

  isGrantSelected(type: PropertyAccessScopeType, id: number): boolean {
    return this.selectedGrantKeys.has(this.grantKey(type, id));
  }

  toggleGrant(type: PropertyAccessScopeType, id: number): void {
    const key = this.grantKey(type, id);
    const next = new Set(this.selectedGrantKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selectedGrantKeys = next;
  }

  addGrants(grants: PropertyAccessGrant[]): void {
    if (!grants.length) {
      return;
    }
    const next = new Set(this.selectedGrantKeys);
    for (const g of grants) {
      next.add(this.grantKey(g.type, g.id));
    }
    this.selectedGrantKeys = next;
    this.cdr.detectChanges();
  }

  selectAllInFloor(floor: TreeFloor, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.addGrants(this.grantEntriesForFloor(floor));
  }

  selectAllInBuilding(building: TreeBuilding, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.addGrants(this.grantEntriesForBuilding(building));
  }

  selectAllInCompound(compoundId: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const next = new Set(this.expandedCompounds);
    next.add(compoundId);
    this.expandedCompounds = next;
    this.addGrants(this.grantEntriesForCompound(compoundId));
  }

  selectAllInSuite(suite: TreeSuite, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.addGrants(this.grantEntriesForSuite(suite));
  }

  private grantEntriesForSuite(suite: TreeSuite): PropertyAccessGrant[] {
    const out: PropertyAccessGrant[] = [{ type: 'suite', id: suite.id }];
    for (const room of suite.rooms || []) {
      out.push({ type: 'room', id: room.id });
    }
    return out;
  }

  private grantEntriesForFloor(floor: TreeFloor): PropertyAccessGrant[] {
    const out: PropertyAccessGrant[] = [{ type: 'floor', id: floor.id }];
    for (const suite of floor.suites || []) {
      out.push(...this.grantEntriesForSuite(suite));
    }
    for (const room of floor.rooms || []) {
      out.push({ type: 'room', id: room.id });
    }
    for (const facility of floor.facilities || []) {
      out.push({ type: 'facility', id: facility.id });
    }
    return out;
  }

  private grantEntriesForBuilding(building: TreeBuilding): PropertyAccessGrant[] {
    const out: PropertyAccessGrant[] = [{ type: 'building', id: building.id }];
    for (const floor of building.floors || []) {
      out.push(...this.grantEntriesForFloor(floor));
    }
    for (const gate of this.buildingGates(building.id)) {
      out.push({ type: 'gate', id: gate.id });
    }
    for (const parking of building.parkings || []) {
      out.push({ type: 'parking', id: parking.id });
    }
    return out;
  }

  private grantEntriesForCompound(compoundId: number): PropertyAccessGrant[] {
    const out: PropertyAccessGrant[] = [{ type: 'compound', id: compoundId }];
    for (const building of this.buildingsForCompound(compoundId)) {
      out.push(...this.grantEntriesForBuilding(building));
    }
    for (const gate of this.compoundLevelGates(compoundId)) {
      out.push({ type: 'gate', id: gate.id });
    }
    return out;
  }

  clearGrants(): void {
    this.selectedGrantKeys = new Set();
  }

  toggleCompoundExpand(compoundId: number): void {
    const next = new Set(this.expandedCompounds);
    if (next.has(compoundId)) {
      next.delete(compoundId);
    } else {
      next.add(compoundId);
    }
    this.expandedCompounds = next;
  }

  isCompoundExpanded(compoundId: number): boolean {
    return this.expandedCompounds.has(compoundId);
  }

  buildingsForCompound(compoundId: number): TreeBuilding[] {
    const buildings = (this.propertyTree?.buildings || []) as TreeBuilding[];
    return buildings.filter((b) => Number(b.compound_id) === compoundId);
  }

  compoundLevelGates(compoundId: number): TreeGate[] {
    const buildingIds = new Set(this.buildingsForCompound(compoundId).map((b) => b.id));
    return ((this.propertyTree?.gates || []) as TreeGate[]).filter(
      (g) => Number(g.compound_id) === compoundId && (!g.building_id || !buildingIds.has(Number(g.building_id))),
    );
  }

  compoundLevelParkings(compoundId: number): TreeParking[] {
    const buildingIds = new Set(this.buildingsForCompound(compoundId).map((b) => b.id));
    const all: TreeParking[] = [];
    for (const b of this.buildingsForCompound(compoundId)) {
      for (const p of b.parkings || []) {
        all.push(p as TreeParking);
      }
    }
    return all.filter((p) => !p.building_id || !buildingIds.has(Number(p.building_id)));
  }

  buildingGates(buildingId: number): TreeGate[] {
    return ((this.propertyTree?.gates || []) as TreeGate[]).filter((g) => Number(g.building_id) === buildingId);
  }

  scopeTypeLabel(type: PropertyAccessScopeType): string {
    return this.translate.instant(`EDU_CA_SCOPE_${type.toUpperCase()}`);
  }

  grantChipText(grant: PropertyAccessGrantDisplay): string {
    const typeLabel = this.scopeTypeLabel(grant.type);
    const name = grant.label || `#${grant.id}`;
    return `${typeLabel}: ${name}`;
  }

  /** Summary chips in the main table (backend-collapsed). */
  listGrantsForRow(row: CompoundAccessRow): PropertyAccessGrantDisplay[] {
    return row.grants_display?.length ? row.grants_display : row.grants ?? [];
  }

  changeStudent(): void {
    if (!this.canSearchStudent || this.saving) {
      return;
    }
    this.selectedStudent = null;
    this.studentQuery = '';
    this.studentHits = [];
    this.studentMenuOpen = false;
    this.focusStudentInput();
  }

  initials(user: CompoundAccessUser | null | undefined): string {
    const name = (user?.name || '').trim();
    if (!name) {
      return user?.id ? String(user.id).slice(-2) : '';
    }
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  onStudentQueryChange(value: string): void {
    this.studentQuery = value;
    if (!this.canSearchStudent) {
      return;
    }
    if (this.selectedStudent && value !== this.studentLabel(this.selectedStudent)) {
      this.selectedStudent = null;
    }
    this.scheduleStudentSearch(value);
  }

  onStudentFocus(): void {
    if (!this.canSearchStudent) {
      return;
    }
    this.studentMenuOpen = true;
    if (this.studentQuery.trim().length >= 2 && !this.studentHits.length && !this.searchingStudents) {
      void this.searchStudents();
    }
  }

  onStudentKeydown(event: KeyboardEvent): void {
    if (!this.canSearchStudent) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.studentMenuOpen = false;
      return;
    }
    if (!this.studentMenuOpen || !this.studentHits.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.studentHighlight = (this.studentHighlight + 1) % this.studentHits.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.studentHighlight = (this.studentHighlight - 1 + this.studentHits.length) % this.studentHits.length;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const hit = this.studentHits[this.studentHighlight] ?? this.studentHits[0];
      if (hit) {
        this.pickStudent(hit);
      }
    }
  }

  clearStudent(): void {
    if (!this.canSearchStudent || this.saving) {
      return;
    }
    this.selectedStudent = null;
    this.studentQuery = '';
    this.studentHits = [];
    this.studentMenuOpen = true;
    this.focusStudentInput();
  }

  async searchStudents(): Promise<void> {
    if (!this.canSearchStudent) {
      return;
    }
    const q = this.studentQuery.trim();
    if (q.length < 2) {
      this.studentHits = [];
      this.searchingStudents = false;
      this.cdr.detectChanges();
      return;
    }

    const gen = ++this.studentSearchGen;
    this.searchingStudents = true;
    this.studentMenuOpen = true;
    this.cdr.detectChanges();
    try {
      const res = await this.compoundAccess.searchUsers(q);
      if (gen !== this.studentSearchGen) {
        return;
      }
      this.studentHits = Array.isArray(res.data) ? res.data : [];
      this.studentHighlight = 0;
    } catch {
      if (gen !== this.studentSearchGen) {
        return;
      }
      this.studentHits = [];
    } finally {
      if (gen === this.studentSearchGen) {
        this.searchingStudents = false;
      }
      this.cdr.detectChanges();
    }
  }

  pickStudent(user: CompoundAccessUser): void {
    this.selectedStudent = user;
    this.studentQuery = this.studentLabel(user);
    this.studentHits = [];
    this.studentMenuOpen = false;
    this.cdr.detectChanges();
  }

  studentLabel(user: CompoundAccessUser | null | undefined): string {
    if (!user) {
      return '';
    }
    return [user.name, user.mobile].filter(Boolean).join(' · ') || user.email || `#${user.id}`;
  }

  contactLabel(user: { email?: string | null; mobile?: string | null } | null | undefined): string {
    const parts = [user?.mobile, user?.email].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  }

  grantsFromSelection(): { type: PropertyAccessScopeType; id: number }[] {
    return [...this.selectedGrantKeys].map((key) => {
      const sep = key.indexOf(':');
      const type = key.slice(0, sep) as PropertyAccessScopeType;
      const id = Number(key.slice(sep + 1));
      return { type, id };
    });
  }

  async save(): Promise<void> {
    const userId = this.selectedStudent?.id ?? this.editingUserId;
    if (!userId) {
      this.snackbar.show(this.translate.instant('EDU_CA_PICK_STUDENT'), 'error');
      return;
    }
    if (this.editingUserId == null && this.selectedCount === 0) {
      this.snackbar.show(this.translate.instant('EDU_CA_PICK_GRANT_FIRST'), 'error');
      return;
    }
    this.saving = true;
    try {
      await this.compoundAccess.sync(userId, this.grantsFromSelection());
      this.dialogOpen = false;
      this.snackbar.show(this.translate.instant('EDU_CA_SAVED'), 'success');
      await this.load();
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async revoke(row: CompoundAccessRow): Promise<void> {
    const ok = await this.openRevokeConfirm(row);
    if (!ok) return;

    this.saving = true;
    try {
      await this.compoundAccess.sync(row.user_id, []);
      this.snackbar.show(this.translate.instant('EDU_CA_REVOKED'), 'success');
      await this.load();
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private async openRevokeConfirm(row: CompoundAccessRow): Promise<boolean> {
    const studentName = row.user?.name || `#${row.user_id}`;
    const grants = this.listGrantsForRow(row).map((g) => this.grantChipText(g)).join(' · ');

    const ref = this.dialogMobile.open(ConfirmDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      width: '440px',
      maxWidth: '94vw',
      data: {
        variant: 'danger',
        titleKey: 'EDU_CA_REVOKE_DIALOG_TITLE',
        hintKey: 'EDU_CA_REVOKE_DIALOG_HINT',
        confirmKey: 'EDU_CA_REVOKE_DIALOG_CONFIRM',
        preview: {
          initials: this.initials(row.user),
          title: studentName,
          subtitle: this.contactLabel(row.user),
          meta: [{ labelKey: 'EDU_CA_GRANTS', value: grants || '—' }],
        },
      },
    });

    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.ca-select')) {
      this.studentMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.dialogOpen) {
      return;
    }
    event.preventDefault();
    if (this.studentMenuOpen) {
      this.studentMenuOpen = false;
      return;
    }
    this.closeDialog();
  }

  private scheduleStudentSearch(raw: string): void {
    if (this.studentSearchTimer) {
      clearTimeout(this.studentSearchTimer);
    }
    const q = raw.trim();
    if (q.length < 2) {
      this.studentSearchGen += 1;
      this.studentHits = [];
      this.searchingStudents = false;
      this.studentMenuOpen = true;
      this.cdr.detectChanges();
      return;
    }
    this.studentMenuOpen = true;
    this.studentSearchTimer = setTimeout(() => void this.searchStudents(), 250);
  }

  private focusStudentInput(): void {
    setTimeout(() => this.studentInput?.nativeElement.focus(), 60);
  }
}
