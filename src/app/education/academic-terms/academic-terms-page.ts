import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AcademicTerm, EducationService, EduSection } from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';
import { AssignTermSectionsDialog } from '../../dialog/assign-term-sections/assign-term-sections';

@Component({
  selector: 'app-academic-terms-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterLink, PageSkeleton],
  templateUrl: './academic-terms-page.html',
  styleUrls: ['../education-shared.css', '../enrollments/enrollments-page.css', './academic-terms-page.css'],
})
export class AcademicTermsPage implements OnInit {
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);

  loading = false;
  initialLoad = true;
  saving = false;
  isRTL = false;
  terms: AcademicTerm[] = [];
  sections: EduSection[] = [];

  form = {
    name: '',
    name_ar: '',
    starts_on: '',
    ends_on: '',
  };

  get showSkeleton(): boolean {
    return this.initialLoad && this.terms.length === 0;
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    void this.load();
  }

  termLabel(t: AcademicTerm): string {
    if (this.isRTL) return t.name_ar || t.name;
    return t.name || t.name_ar || '';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = this.parseDateValue(value);
    if (!d) return '—';
    const locale = this.isRTL ? 'ar-SA' : 'en-GB';
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private parseDateValue(value: string): Date | null {
    // Pure YYYY-MM-DD: treat as local calendar day (no UTC shift).
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      const local = new Date(y, m - 1, d);
      return Number.isNaN(local.getTime()) ? null : local;
    }
    // ISO datetime from Laravel date casts: use local calendar day.
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  async load(): Promise<void> {
    const hadData = this.terms.length > 0;
    if (!hadData) {
      this.loading = true;
    }
    try {
      const [termsRes, sectionsRes] = await Promise.all([
        this.edu.getAcademicTerms(),
        this.edu.getSections(),
      ]);
      this.terms = termsRes.data || [];
      this.sections = sectionsRes.data || [];
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  async createTerm(): Promise<void> {
    if (!this.form.name.trim()) {
      this.snackbar.show(this.translate.instant('TERM_REQUIRED'), 'error');
      return;
    }
    this.saving = true;
    try {
      await this.edu.createAcademicTerm({
        name: this.form.name.trim(),
        name_ar: this.form.name_ar.trim() || null,
        starts_on: this.form.starts_on || null,
        ends_on: this.form.ends_on || null,
      });
      this.form = { name: '', name_ar: '', starts_on: '', ends_on: '' };
      this.snackbar.show(this.translate.instant('TERM_CREATED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async closeTerm(term: AcademicTerm): Promise<void> {
    const ok = confirm(this.translate.instant('TERM_CLOSE_CONFIRM', { name: this.termLabel(term) }));
    if (!ok) return;
    try {
      const res = await this.edu.closeAcademicTerm(term.id);
      this.snackbar.show(
        this.translate.instant('TERM_CLOSED', { n: res.data?.archived_count ?? 0 }),
        'success',
      );
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async deleteTerm(term: AcademicTerm): Promise<void> {
    const ok = confirm(this.translate.instant('TERM_DELETE_CONFIRM', { name: this.termLabel(term) }));
    if (!ok) return;
    try {
      await this.edu.deleteAcademicTerm(term.id);
      this.snackbar.show(this.translate.instant('TERM_DELETED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  startAssign(term: AcademicTerm): void {
    const selectedIds = this.sections
      .filter((s) => s.academic_term_id === term.id)
      .map((s) => s.id);

    this.dialog
      .open(AssignTermSectionsDialog, {
        panelClass: ['custom-dialog'],
        backdropClass: 'custom-backdrop',
        width: '520px',
        maxWidth: '94vw',
        maxHeight: '90vh',
        autoFocus: false,
        data: { term, sections: this.sections, selectedIds },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) void this.load();
      });
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string }; message?: string })?.error?.message
      || (e as { message?: string })?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
