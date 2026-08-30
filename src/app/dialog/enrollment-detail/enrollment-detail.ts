import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AcademicTerm,
  EducationService,
  EduEnrollmentRow,
  EduSubject,
} from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';
import { BookingAccessExtras } from '../../bookings/booking-access-extras/booking-access-extras';
import { BookingExtraPick } from '../../bookings/booking-extra-unit';

export interface EnrollmentDetailDialogData {
  userId: number;
  user?: { id: number; name?: string; email?: string } | null;
  rows: EduEnrollmentRow[];
}

@Component({
  selector: 'app-enrollment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BookingAccessExtras],
  templateUrl: './enrollment-detail.html',
  styleUrls: ['../add-subject/add-subject.css', '../add-enrollment/add-enrollment.css', './enrollment-detail.css'],
})
export class EnrollmentDetail implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<EnrollmentDetail, boolean | { edit: true; userId: number }>);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  saving = false;
  loadingAccessExtras = false;
  changed = false;
  rows: EduEnrollmentRow[] = [];
  accessExtras: BookingExtraPick[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: EnrollmentDetailDialogData) {
    this.rows = [...(data.rows || [])];
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    void this.loadAccessExtras();
  }

  get studentName(): string {
    return this.data.user?.name || this.data.user?.email || `#${this.data.userId}`;
  }

  get enrolledTermsLabel(): string {
    const labels = [...new Set(
      this.rows
        .map((row) => this.termLabel(this.termOf(row)))
        .filter((name) => !!name),
    )];
    return labels.length ? labels.join(' · ') : this.translate.instant('ENR_NO_TERM');
  }

  termOf(row: EduEnrollmentRow): AcademicTerm | null {
    const section = row.enrollment.section;
    return section?.academic_term ?? section?.academicTerm ?? null;
  }

  termLabel(term?: AcademicTerm | null): string {
    if (!term) return '';
    if (this.isRTL) return term.name_ar || term.name || '';
    return term.name || term.name_ar || '';
  }

  subjectLabel(s?: EduSubject | null): string {
    if (!s) return '';
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  enrollmentLabel(row: EduEnrollmentRow): string {
    const subject = this.subjectLabel(row.enrollment.section?.subject);
    const section = row.enrollment.section?.number || row.enrollment.section_id;
    return subject ? `${subject} — ${section}` : String(section);
  }

  statusKey(status: string): string {
    return 'ENR_STATUS_' + (status || '').toUpperCase();
  }

  onAccessExtrasChange(picks: BookingExtraPick[]): void {
    this.accessExtras = picks;
    this.cdr.detectChanges();
  }

  close(): void {
    this.dialogRef.close(this.changed);
  }

  editEnrollment(): void {
    this.dialogRef.close({ edit: true, userId: this.data.userId });
  }

  async setStatus(row: EduEnrollmentRow, status: string): Promise<void> {
    try {
      await this.edu.updateEnrollmentStatus(row.enrollment.id, status);
      row.enrollment.status = status;
      this.changed = true;
      this.snackbar.show(this.translate.instant('ENR_STATUS_UPDATED'), 'success');
      this.cdr.detectChanges();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async remove(row: EduEnrollmentRow): Promise<void> {
    const ok = confirm(
      this.translate.instant('ENR_DELETE_CONFIRM', { name: this.enrollmentLabel(row) }),
    );
    if (!ok) return;
    try {
      await this.edu.removeEnrollment(row.enrollment.id);
      this.rows = this.rows.filter((r) => r.enrollment.id !== row.enrollment.id);
      this.changed = true;
      this.snackbar.show(this.translate.instant('ENR_DELETED'), 'success');
      this.cdr.detectChanges();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async saveAccessExtras(): Promise<void> {
    this.saving = true;
    try {
      await this.edu.syncStudentFacilityAccess(
        this.data.userId,
        this.accessExtras.map((p) => ({ unit_type: p.unit_type, unit_id: p.unit_id })),
      );
      this.changed = true;
      this.snackbar.show(this.translate.instant('ENR_FACILITIES_SAVED'), 'success');
      this.close();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private async loadAccessExtras(): Promise<void> {
    this.loadingAccessExtras = true;
    try {
      const res = await this.edu.getStudentFacilityAccess(this.data.userId);
      const linked = res.data?.linked_units || [];
      if (linked.length) {
        this.accessExtras = linked.map((u) => ({
          unit_type: u.unit_type,
          unit_id: u.unit_id,
        }));
      } else {
        this.accessExtras = (res.data?.linked_facility_ids || []).map((id) => ({
          unit_type: 'facility' as const,
          unit_id: id,
        }));
      }
    } catch {
      this.accessExtras = [];
    } finally {
      this.loadingAccessExtras = false;
      this.cdr.detectChanges();
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
