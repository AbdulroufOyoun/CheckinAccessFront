import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../services/snackbar.service';
import { ConfirmDialog } from '../dialog/confirm-dialog/confirm-dialog';
import {
  CompoundAccessCompound,
  CompoundAccessRow,
  CompoundAccessUser,
  CompoundAccessService,
} from '../services/compound-access.service';

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
  private readonly dialog = inject(MatDialog);

  @ViewChild('studentInput') private studentInput?: ElementRef<HTMLInputElement>;

  isRTL = false;
  loading = false;
  initialLoad = true;
  saving = false;
  rows: CompoundAccessRow[] = [];
  compounds: CompoundAccessCompound[] = [];
  filter = '';

  dialogOpen = false;
  editingUserId: number | null = null;
  studentQuery = '';
  studentHits: CompoundAccessUser[] = [];
  searchingStudents = false;
  studentMenuOpen = false;
  studentHighlight = 0;
  selectedStudent: CompoundAccessUser | null = null;
  selectedCompoundIds = new Set<number>();

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
      const compounds = row.compounds.map((c) => `${c.name || ''} ${c.number || ''}`).join(' ').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        mobile.includes(q) ||
        (digits.length >= 3 && mobileDigits.includes(digits)) ||
        compounds.includes(q)
      );
    });
  }

  get canSearchStudent(): boolean {
    return this.editingUserId == null;
  }

  get selectedCount(): number {
    return this.selectedCompoundIds.size;
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
      const [rowsRes, compoundsRes] = await Promise.all([
        this.compoundAccess.list(),
        this.compoundAccess.listCompounds(),
      ]);
      this.rows = Array.isArray(rowsRes.data) ? rowsRes.data : [];
      this.compounds = Array.isArray(compoundsRes.data) ? compoundsRes.data : [];
    } catch {
      this.snackbar.show(this.translate.instant('EDU_CA_LOAD_FAILED'), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  openCreate(): void {
    this.editingUserId = null;
    this.selectedStudent = null;
    this.selectedCompoundIds = new Set();
    this.studentQuery = '';
    this.studentHits = [];
    this.studentMenuOpen = false;
    this.studentHighlight = 0;
    this.dialogOpen = true;
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
    this.selectedCompoundIds = new Set(row.compounds.map((c) => c.id));
    this.studentQuery = this.studentLabel(this.selectedStudent);
    this.studentHits = [];
    this.studentMenuOpen = false;
    this.dialogOpen = true;
  }

  closeDialog(): void {
    if (this.saving) {
      return;
    }
    this.dialogOpen = false;
    this.studentMenuOpen = false;
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

  selectAllCompounds(): void {
    this.selectedCompoundIds = new Set(this.compounds.map((c) => c.id));
  }

  clearCompounds(): void {
    this.selectedCompoundIds = new Set();
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

  isSelected(id: number): boolean {
    return this.selectedCompoundIds.has(id);
  }

  toggleCompound(id: number): void {
    const next = new Set(this.selectedCompoundIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedCompoundIds = next;
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

  async save(): Promise<void> {
    const userId = this.selectedStudent?.id ?? this.editingUserId;
    if (!userId) {
      this.snackbar.show(this.translate.instant('EDU_CA_PICK_STUDENT'), 'error');
      return;
    }
    if (this.editingUserId == null && this.selectedCount === 0) {
      this.snackbar.show(this.translate.instant('EDU_CA_PICK_COMPOUND_FIRST'), 'error');
      return;
    }
    this.saving = true;
    try {
      await this.compoundAccess.sync(userId, [...this.selectedCompoundIds]);
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
    const compounds = row.compounds.map((c) => this.compoundLabel(c)).join(' · ');

    const ref = this.dialog.open(ConfirmDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '440px',
      maxWidth: '94vw',
      autoFocus: false,
      data: {
        variant: 'danger',
        titleKey: 'EDU_CA_REVOKE_DIALOG_TITLE',
        hintKey: 'EDU_CA_REVOKE_DIALOG_HINT',
        confirmKey: 'EDU_CA_REVOKE_DIALOG_CONFIRM',
        preview: {
          initials: this.initials(row.user),
          title: studentName,
          subtitle: this.contactLabel(row.user),
          meta: [
            { labelKey: 'EDU_CA_COMPOUNDS', value: compounds || '—' },
          ],
        },
      },
    });

    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  compoundLabel(compound: CompoundAccessCompound): string {
    return [compound.name, compound.number].filter(Boolean).join(' · ') || `#${compound.id}`;
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
