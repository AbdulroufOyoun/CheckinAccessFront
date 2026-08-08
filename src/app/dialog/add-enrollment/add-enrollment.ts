import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EducationService, EduSection, EduSubject } from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface EnrollUserOption {
  id: number;
  name?: string;
  email?: string;
}

export interface AddEnrollmentDialogData {
  users: EnrollUserOption[];
  sections: EduSection[];
}

@Component({
  selector: 'app-add-enrollment',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-enrollment.html',
  styleUrls: ['../add-subject/add-subject.css'],
})
export class AddEnrollment implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddEnrollment>);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  saving = false;
  isRTL = false;
  users: EnrollUserOption[] = [];
  sections: EduSection[] = [];

  form = {
    user_id: '' as number | '',
    section_id: '' as number | '',
    status: 'enrolled',
  };

  statuses = ['enrolled', 'dropped', 'completed'] as const;

  constructor(@Inject(MAT_DIALOG_DATA) public data: AddEnrollmentDialogData) {
    this.users = data?.users || [];
    this.sections = data?.sections || [];
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
  }

  subjectLabel(s?: EduSubject | null): string {
    if (!s) return '';
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  sectionLabel(sec: EduSection): string {
    const subj = this.subjectLabel(sec.subject) || this.translate.instant('SEC_SUBJECT');
    return `${subj} — ${sec.number}`;
  }

  userLabel(u: EnrollUserOption): string {
    return u.name || u.email || `#${u.id}`;
  }

  get selectedUser(): EnrollUserOption | undefined {
    return this.users.find((u) => u.id === this.form.user_id);
  }

  get selectedSection(): EduSection | undefined {
    return this.sections.find((s) => s.id === this.form.section_id);
  }

  get previewTitle(): string {
    return this.selectedUser
      ? this.userLabel(this.selectedUser)
      : this.translate.instant('ENR_UNTITLED');
  }

  get previewMeta(): string {
    const sec = this.selectedSection
      ? this.sectionLabel(this.selectedSection)
      : this.translate.instant('ENR_NO_SECTION');
    const status = this.translate.instant('ENR_STATUS_' + this.form.status.toUpperCase());
    return `${sec} · ${status}`;
  }

  get canSave(): boolean {
    return !!this.form.user_id && !!this.form.section_id;
  }

  close(saved = false): void {
    this.dialogRef.close(saved);
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      this.snackbar.show(this.translate.instant('ENR_REQUIRED'), 'error');
      return;
    }

    this.saving = true;
    try {
      await this.edu.enroll({
        user_id: Number(this.form.user_id),
        section_id: Number(this.form.section_id),
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
}
