import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EducationService, EduSubject } from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface AddSubjectDialogData {
  mode: 'add' | 'edit';
  subject?: EduSubject;
  subjects: EduSubject[];
}

@Component({
  selector: 'app-add-subject',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-subject.html',
  styleUrl: './add-subject.css',
})
export class AddSubject implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddSubject>);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  saving = false;
  mode: 'add' | 'edit' = 'add';
  subjects: EduSubject[] = [];
  editingId: number | null = null;
  hourPresets = [1, 2, 3, 4, 6];
  isRTL = false;

  form = {
    name: '',
    name_ar: '',
    short_name: '',
    hours: 3,
    has_practical: false,
    required_subject_id: '' as number | '',
    active: true,
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: AddSubjectDialogData) {
    this.mode = data?.mode || 'add';
    this.subjects = data?.subjects || [];
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';

    if (this.mode === 'edit' && this.data.subject) {
      const s = this.data.subject;
      this.editingId = s.id;
      this.form = {
        name: s.name || '',
        name_ar: s.name_ar || '',
        short_name: s.short_name || '',
        hours: s.hours ?? 3,
        has_practical: !!s.has_practical,
        required_subject_id: s.required_subject_id || '',
        active: s.active !== false,
      };
    }
  }

  get prerequisiteOptions(): EduSubject[] {
    return this.subjects.filter((s) => s.id !== this.editingId);
  }

  get previewName(): string {
    if (this.isRTL) {
      return this.form.name_ar.trim() || this.form.name.trim() || this.translate.instant('SUBJ_UNTITLED');
    }
    return this.form.name.trim() || this.form.name_ar.trim() || this.translate.instant('SUBJ_UNTITLED');
  }

  get previewNameSecondary(): string {
    if (this.isRTL) {
      return this.form.name.trim();
    }
    return this.form.name_ar.trim();
  }

  get previewCode(): string {
    const code = this.form.short_name.trim();
    if (code) return code.toUpperCase();
    const fromName = (this.form.name || this.form.name_ar)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');
    return fromName || 'NEW';
  }

  get previewMeta(): string {
    const hours = this.translate.instant('SUBJ_PREVIEW_HOURS', { hours: this.form.hours || 0 });
    const type = this.form.has_practical
      ? this.translate.instant('SUBJ_THEORY_PRACTICAL')
      : this.translate.instant('SUBJ_THEORY');
    const status = this.form.active
      ? this.translate.instant('ACTIVE')
      : this.translate.instant('INACTIVE');
    return `${hours} · ${type} · ${status}`;
  }

  get prerequisiteLabel(): string {
    if (!this.form.required_subject_id) {
      return this.translate.instant('SUBJ_NO_PREREQ');
    }
    const found = this.subjects.find((s) => s.id === this.form.required_subject_id);
    if (!found) return this.translate.instant('SUBJ_PREREQ_SELECTED');
    return this.translate.instant('SUBJ_REQUIRES', {
      name: found.short_name || this.subjectLabel(found),
    });
  }

  subjectLabel(s: EduSubject): string {
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  get canSave(): boolean {
    return !!this.form.name.trim() && !!this.form.name_ar.trim();
  }

  close(saved = false): void {
    this.dialogRef.close(saved);
  }

  setHours(value: number): void {
    this.form.hours = value;
  }

  bumpHours(delta: number): void {
    const next = Number(this.form.hours || 0) + delta;
    this.form.hours = Math.max(0, Math.min(999, next));
  }

  async save(): Promise<void> {
    if (!this.form.name.trim() || !this.form.name_ar.trim()) {
      this.snackbar.show(this.translate.instant('SUBJ_NAME_BOTH_REQUIRED'), 'error');
      return;
    }

    this.saving = true;
    const body = {
      name: this.form.name.trim(),
      name_ar: this.form.name_ar.trim(),
      short_name: this.form.short_name.trim() || null,
      hours: Number(this.form.hours) || 0,
      has_practical: this.form.has_practical,
      required_subject_id: this.form.required_subject_id || null,
      active: this.form.active,
    };

    try {
      if (this.mode === 'edit' && this.editingId) {
        await this.edu.updateSubject(this.editingId, body);
        this.snackbar.show(this.translate.instant('SUBJ_UPDATED'), 'success');
      } else {
        await this.edu.createSubject(body);
        this.snackbar.show(this.translate.instant('SUBJ_CREATED'), 'success');
      }
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
