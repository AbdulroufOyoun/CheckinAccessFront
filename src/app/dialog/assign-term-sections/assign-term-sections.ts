import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AcademicTerm, EducationService, EduSection } from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface AssignTermSectionsData {
  term: AcademicTerm;
  sections: EduSection[];
  selectedIds: number[];
}

@Component({
  selector: 'app-assign-term-sections',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TranslateModule],
  templateUrl: './assign-term-sections.html',
  styleUrl: './assign-term-sections.css',
})
export class AssignTermSectionsDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AssignTermSectionsDialog, boolean>);
  private readonly data = inject<AssignTermSectionsData>(MAT_DIALOG_DATA);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  saving = false;
  isRTL = false;
  sections: EduSection[] = [];
  selectedSectionIds = new Set<number>();

  get termLabel(): string {
    if (this.isRTL) return this.data.term.name_ar || this.data.term.name;
    return this.data.term.name || this.data.term.name_ar || '';
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    this.sections = this.data.sections || [];
    this.selectedSectionIds = new Set(this.data.selectedIds || []);
  }

  toggleSection(id: number): void {
    if (this.selectedSectionIds.has(id)) this.selectedSectionIds.delete(id);
    else this.selectedSectionIds.add(id);
  }

  isChecked(id: number): boolean {
    return this.selectedSectionIds.has(id);
  }

  sectionOptionLabel(s: EduSection): string {
    const subj = this.isRTL
      ? (s.subject?.name_ar || s.subject?.name || '')
      : (s.subject?.name || s.subject?.name_ar || '');
    return `${subj} — ${s.number}`;
  }

  async save(): Promise<void> {
    this.saving = true;
    this.cdr.detectChanges();
    try {
      await this.edu.assignSectionsToTerm(this.data.term.id, Array.from(this.selectedSectionIds));
      this.snackbar.show(this.translate.instant('TERM_SECTIONS_ASSIGNED'), 'success');
      this.dialogRef.close(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string }; message?: string })?.error?.message
      || (e as { message?: string })?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
