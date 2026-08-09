import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AcademicTerm,
  EducationService,
  EduSection,
  EduSectionTime,
  EduSubject,
} from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface EnrollUserOption {
  id: number;
  name?: string;
  email?: string;
}

export interface AddEnrollmentDialogData {
  users: EnrollUserOption[];
  terms?: AcademicTerm[];
}

@Component({
  selector: 'app-add-enrollment',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-enrollment.html',
  styleUrls: ['../add-subject/add-subject.css', './add-enrollment.css'],
})
export class AddEnrollment implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddEnrollment>);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  saving = false;
  loadingSections = false;
  loadingSchedule = false;
  isRTL = false;
  users: EnrollUserOption[] = [];
  terms: AcademicTerm[] = [];
  termSections: EduSection[] = [];
  selectedSectionIds = new Set<number>();
  conflictBySectionId = new Map<number, string>();
  enrolledSections: EduSection[] = [];

  form = {
    user_id: '' as number | '',
    academic_term_id: '' as number | '',
    status: 'enrolled',
  };

  statuses = ['enrolled', 'dropped', 'completed'] as const;

  constructor(@Inject(MAT_DIALOG_DATA) public data: AddEnrollmentDialogData) {
    this.users = data?.users || [];
    this.terms = data?.terms || [];
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    if (!this.terms.length) {
      void this.loadTerms();
    }
  }

  subjectLabel(s?: EduSubject | null): string {
    if (!s) return '';
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  termLabel(t: AcademicTerm): string {
    if (this.isRTL) return t.name_ar || t.name;
    return t.name || t.name_ar || '';
  }

  sectionLabel(sec: EduSection): string {
    const subj = this.subjectLabel(sec.subject) || this.translate.instant('SEC_SUBJECT');
    return `${subj} — ${sec.number}`;
  }

  sectionTimesLabel(sec: EduSection): string {
    const times = this.sectionTimes(sec);
    if (!times.length) return this.translate.instant('ENR_NO_TIMES');
    return times
      .map((t) => {
        const day = this.isRTL
          ? (t.day?.name_ar || t.day?.name || '')
          : (t.day?.name || t.day?.name_ar || '');
        return `${day} ${this.hhmm(t.start)}–${this.hhmm(t.end)}`.trim();
      })
      .join(' · ');
  }

  userLabel(u: EnrollUserOption): string {
    return u.name || u.email || `#${u.id}`;
  }

  get selectedUser(): EnrollUserOption | undefined {
    return this.users.find((u) => u.id === this.form.user_id);
  }

  get selectedTerm(): AcademicTerm | undefined {
    return this.terms.find((t) => t.id === this.form.academic_term_id);
  }

  get selectedCount(): number {
    return this.selectedSectionIds.size;
  }

  get previewTitle(): string {
    return this.selectedUser
      ? this.userLabel(this.selectedUser)
      : this.translate.instant('ENR_UNTITLED');
  }

  get previewMeta(): string {
    const term = this.selectedTerm
      ? this.termLabel(this.selectedTerm)
      : this.translate.instant('ENR_NO_TERM');
    const count = this.translate.instant('ENR_SELECTED_COUNT', { n: this.selectedCount });
    const status = this.translate.instant('ENR_STATUS_' + this.form.status.toUpperCase());
    return `${term} · ${count} · ${status}`;
  }

  get canSave(): boolean {
    return !!this.form.user_id && !!this.form.academic_term_id && this.selectedCount > 0;
  }

  isChecked(id: number): boolean {
    return this.selectedSectionIds.has(id);
  }

  conflictReason(id: number): string | undefined {
    return this.conflictBySectionId.get(id);
  }

  async onStudentChange(): Promise<void> {
    this.selectedSectionIds.clear();
    this.conflictBySectionId.clear();
    this.enrolledSections = [];
    if (!this.form.user_id) {
      this.recomputeConflicts();
      this.cdr.detectChanges();
      return;
    }
    await this.loadStudentSchedule(Number(this.form.user_id));
    this.recomputeConflicts();
    this.cdr.detectChanges();
  }

  async onTermChange(): Promise<void> {
    this.selectedSectionIds.clear();
    this.conflictBySectionId.clear();
    this.termSections = [];
    if (!this.form.academic_term_id) {
      this.cdr.detectChanges();
      return;
    }
    await this.loadTermSections(Number(this.form.academic_term_id));
    this.recomputeConflicts();
    this.cdr.detectChanges();
  }

  toggleSection(sec: EduSection): void {
    if (this.selectedSectionIds.has(sec.id)) {
      this.selectedSectionIds.delete(sec.id);
      this.recomputeConflicts();
      this.cdr.detectChanges();
      return;
    }

    const reason = this.conflictReasonForCandidate(sec, this.selectedSectionIds);
    if (reason) {
      this.snackbar.show(reason, 'error');
      return;
    }

    this.selectedSectionIds.add(sec.id);
    this.recomputeConflicts();
    this.cdr.detectChanges();
  }

  close(saved = false): void {
    this.dialogRef.close(saved);
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      this.snackbar.show(this.translate.instant('ENR_REQUIRED'), 'error');
      return;
    }

    this.recomputeConflicts();
    for (const id of this.selectedSectionIds) {
      const reason = this.conflictBySectionId.get(id);
      if (reason) {
        this.snackbar.show(reason, 'error');
        return;
      }
    }

    this.saving = true;
    try {
      await this.edu.enroll({
        user_id: Number(this.form.user_id),
        academic_term_id: Number(this.form.academic_term_id),
        section_ids: Array.from(this.selectedSectionIds),
        status: this.form.status,
      });
      this.snackbar.show(this.translate.instant('ENR_CREATED'), 'success');
      this.close(true);
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'),
        'error',
      );
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private async loadTerms(): Promise<void> {
    try {
      const res = await this.edu.getAcademicTerms('open');
      this.terms = res.data || [];
    } catch {
      this.terms = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  private async loadTermSections(termId: number): Promise<void> {
    this.loadingSections = true;
    this.cdr.detectChanges();
    try {
      const res = await this.edu.getSections({ academic_term_id: termId, active: true });
      this.termSections = (res.data || []).filter((s) => s.active !== false);
    } catch (e: unknown) {
      this.termSections = [];
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'),
        'error',
      );
    } finally {
      this.loadingSections = false;
    }
  }

  private async loadStudentSchedule(userId: number): Promise<void> {
    this.loadingSchedule = true;
    this.cdr.detectChanges();
    try {
      const res = await this.edu.getStudentSchedule(userId);
      const enrollments = res.data?.enrollments || [];
      this.enrolledSections = enrollments
        .map((row) => {
          const enrollment = row as {
            section?: EduSection;
            status?: string;
          };
          return enrollment.section;
        })
        .filter((s): s is EduSection => !!s);
    } catch {
      this.enrolledSections = [];
    } finally {
      this.loadingSchedule = false;
    }
  }

  private recomputeConflicts(): void {
    this.conflictBySectionId.clear();
    for (const sec of this.termSections) {
      if (this.selectedSectionIds.has(sec.id)) {
        continue;
      }
      const reason = this.conflictReasonForCandidate(sec, this.selectedSectionIds);
      if (reason) {
        this.conflictBySectionId.set(sec.id, reason);
      }
    }
  }

  private conflictReasonForCandidate(candidate: EduSection, selectedIds: Set<number>): string | undefined {
    const peers: EduSection[] = [
      ...this.termSections.filter((s) => selectedIds.has(s.id)),
      ...this.enrolledSections,
    ];

    for (const peer of peers) {
      if (peer.id === candidate.id) continue;

      if (peer.subject_id && candidate.subject_id && peer.subject_id === candidate.subject_id) {
        return this.translate.instant('ENR_CONFLICT_SUBJECT', {
          subject: this.subjectLabel(candidate.subject) || candidate.number,
        });
      }

      const overlap = this.findOverlap(candidate, peer);
      if (overlap) {
        return this.translate.instant('ENR_CONFLICT_TIME', {
          a: this.sectionLabel(candidate),
          b: this.sectionLabel(peer),
          day: overlap.day,
          slot: overlap.slot,
        });
      }
    }

    return undefined;
  }

  private findOverlap(
    a: EduSection,
    b: EduSection,
  ): { day: string; slot: string } | null {
    for (const ta of this.sectionTimes(a)) {
      for (const tb of this.sectionTimes(b)) {
        if (Number(ta.day_id) !== Number(tb.day_id)) continue;
        if (!this.timesOverlap(ta.start, ta.end, tb.start, tb.end)) continue;
        const day = this.isRTL
          ? (ta.day?.name_ar || ta.day?.name || tb.day?.name_ar || tb.day?.name || '')
          : (ta.day?.name || ta.day?.name_ar || tb.day?.name || tb.day?.name_ar || '');
        return {
          day,
          slot: `${this.hhmm(ta.start)}–${this.hhmm(ta.end)}`,
        };
      }
    }
    return null;
  }

  private sectionTimes(sec: EduSection): EduSectionTime[] {
    return sec.section_times || sec.sectionTimes || [];
  }

  private timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    const a0 = this.toMinutes(startA);
    const a1 = this.toMinutes(endA);
    const b0 = this.toMinutes(startB);
    const b1 = this.toMinutes(endB);
    if (a0 === null || a1 === null || b0 === null || b1 === null) return false;
    return a0 < b1 && a1 > b0;
  }

  private toMinutes(time: string): number | null {
    const m = String(time || '').match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  private hhmm(time: string): string {
    return String(time || '').slice(0, 5);
  }
}
