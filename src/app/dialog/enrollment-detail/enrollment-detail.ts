import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  EducationService,
  EduEnrollmentRow,
  EduFacilityOption,
  EduSubject,
} from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface EnrollmentDetailDialogData {
  userId: number;
  user?: { id: number; name?: string; email?: string } | null;
  rows: EduEnrollmentRow[];
}

@Component({
  selector: 'app-enrollment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './enrollment-detail.html',
  styleUrls: ['../add-subject/add-subject.css', '../add-enrollment/add-enrollment.css', './enrollment-detail.css'],
})
export class EnrollmentDetail implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<EnrollmentDetail, boolean>);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  saving = false;
  loadingFacilities = false;
  changed = false;
  rows: EduEnrollmentRow[] = [];
  facilities: EduFacilityOption[] = [];
  selectedFacilityIds = new Set<number>();

  constructor(@Inject(MAT_DIALOG_DATA) public data: EnrollmentDetailDialogData) {
    this.rows = [...(data.rows || [])];
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    void this.loadFacilities();
  }

  get studentName(): string {
    return this.data.user?.name || this.data.user?.email || `#${this.data.userId}`;
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

  isFacilityChecked(id: number): boolean {
    return this.selectedFacilityIds.has(id);
  }

  toggleFacility(id: number): void {
    if (this.selectedFacilityIds.has(id)) {
      this.selectedFacilityIds.delete(id);
    } else {
      this.selectedFacilityIds.add(id);
    }
    this.cdr.detectChanges();
  }

  close(): void {
    this.dialogRef.close(this.changed);
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

  async saveFacilities(): Promise<void> {
    this.saving = true;
    try {
      await this.edu.syncStudentFacilityAccess(this.data.userId, Array.from(this.selectedFacilityIds));
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

  private async loadFacilities(): Promise<void> {
    this.loadingFacilities = true;
    try {
      const res = await this.edu.getStudentFacilityAccess(this.data.userId);
      this.facilities = res.data?.facilities || [];
      this.selectedFacilityIds = new Set(res.data?.linked_facility_ids || []);
    } catch {
      this.facilities = [];
    } finally {
      this.loadingFacilities = false;
      this.cdr.detectChanges();
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
