import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EducationService, EduSubject } from '../../services/education.service';
import { EducationReferenceCache } from '../../services/education-reference-cache.service';
import { SnackbarService } from '../../services/snackbar.service';
import { AddSubject } from '../../dialog/add-subject/add-subject';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

@Component({
  selector: 'app-subjects-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './subjects-page.html',
  styleUrls: ['../education-shared.css', './subjects-page.css'],
})
export class SubjectsPage implements OnInit {
  private readonly edu = inject(EducationService);
  private readonly subjectsCache = inject(EducationReferenceCache);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  subjects: EduSubject[] = [];
  filtered: EduSubject[] = [];
  loading = false;
  initialLoad = true;
  search = '';
  isRTL = false;

  get showSkeleton(): boolean {
    return this.initialLoad && this.subjects.length === 0;
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    const cached = this.subjectsCache.peekSubjects();
    if (cached?.length) {
      this.subjects = cached;
      this.applyFilter();
      this.initialLoad = false;
    }
    void this.load();
  }

  async load(force = false): Promise<void> {
    const hadData = this.subjects.length > 0;
    if (!hadData) {
      this.loading = true;
    }
    try {
      this.subjects = await this.subjectsCache.getSubjects({ force, allowStale: !force });
      this.applyFilter();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = !q
      ? [...this.subjects]
      : this.subjects.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.name_ar || '').toLowerCase().includes(q) ||
            (s.short_name || '').toLowerCase().includes(q),
        );
  }

  displayName(s: EduSubject): string {
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  secondaryName(s: EduSubject): string {
    if (this.isRTL) return s.name !== (s.name_ar || '') ? s.name : '';
    return s.name_ar && s.name_ar !== s.name ? s.name_ar : '';
  }

  openSections(s: EduSubject): void {
    void this.router.navigate(['/Education/Sections'], {
      queryParams: { subject_id: s.id },
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(AddSubject, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'add', subjects: this.subjects },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.load(true);
    });
  }

  openEdit(s: EduSubject, event?: Event): void {
    event?.stopPropagation();
    const ref = this.dialog.open(AddSubject, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'edit', subject: s, subjects: this.subjects },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.load(true);
    });
  }

  async remove(s: EduSubject, event?: Event): Promise<void> {
    event?.stopPropagation();
    const ok = confirm(
      this.translate.instant('SUBJ_DELETE_CONFIRM', { name: this.displayName(s) }),
    );
    if (!ok) return;
    try {
      await this.edu.deleteSubject(s.id);
      this.snackbar.show(this.translate.instant('SUBJ_DELETED'), 'success');
      await this.load(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
