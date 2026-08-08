import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AcademicTerm,
  EducationService,
  EduEnrollmentArchiveRow,
} from '../../services/education.service';
import { EducationReferenceCache } from '../../services/education-reference-cache.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

interface SimpleUser {
  id: number;
  name?: string;
  email?: string;
}

@Component({
  selector: 'app-enrollment-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterLink, PageSkeleton],
  templateUrl: './enrollment-history-page.html',
  styleUrls: ['../education-shared.css', '../enrollments/enrollments-page.css', './enrollment-history-page.css'],
})
export class EnrollmentHistoryPage implements OnInit {
  private readonly edu = inject(EducationService);
  private readonly historyCache = inject(EducationReferenceCache);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  loading = false;
  initialLoad = true;
  isRTL = false;
  rows: EduEnrollmentArchiveRow[] = [];
  filtered: EduEnrollmentArchiveRow[] = [];
  terms: AcademicTerm[] = [];
  users: SimpleUser[] = [];

  search = '';
  statusFilter = '';
  termFilter: number | null = null;
  userFilter: number | null = null;

  statuses = ['', 'enrolled', 'dropped', 'completed'] as const;

  get showSkeleton(): boolean {
    return this.initialLoad && this.rows.length === 0;
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    const cached = this.historyCache.peekEnrollmentHistoryBundle();
    if (cached) {
      this.applyBundle(cached);
      this.initialLoad = false;
    }
    void this.bootstrap();
  }

  async bootstrap(force = false): Promise<void> {
    const hadData = this.rows.length > 0;
    if (!hadData) {
      this.loading = true;
    }
    try {
      const bundle = await this.historyCache.getEnrollmentHistoryBundle({
        force,
        allowStale: !force,
      });
      this.applyBundle(bundle);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  private applyBundle(bundle: { archives?: EduEnrollmentArchiveRow[]; terms?: AcademicTerm[] }): void {
    this.rows = bundle.archives || [];
    this.terms = bundle.terms || [];
    this.syncUserFilterOptions();
    this.applyFilter();
  }

  private syncUserFilterOptions(): void {
    const byId = new Map<number, SimpleUser>();
    for (const row of this.rows) {
      const id = row.user?.id ?? row.archive.user_id;
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        name: row.user?.name,
        email: row.user?.email,
      });
    }
    this.users = [...byId.values()].sort((a, b) => {
      const an = (a.name || a.email || '').toLowerCase();
      const bn = (b.name || b.email || '').toLowerCase();
      return an.localeCompare(bn);
    });
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.rows.filter((row) => {
      const a = row.archive;
      const student = (row.user?.name || row.user?.email || '').toLowerCase();
      const subject = this.subjectLabel(row).toLowerCase();
      const matchSearch = !q
        || student.includes(q)
        || subject.includes(q)
        || String(a.section_number || '').toLowerCase().includes(q)
        || String(a.user_id).includes(q);
      const matchStatus = !this.statusFilter || a.status === this.statusFilter;
      const matchTerm = !this.termFilter || a.academic_term_id === this.termFilter;
      const matchUser = !this.userFilter || a.user_id === this.userFilter;
      return matchSearch && matchStatus && matchTerm && matchUser;
    });
  }

  subjectLabel(row: EduEnrollmentArchiveRow): string {
    const a = row.archive;
    if (this.isRTL) return a.subject_name_ar || a.subject_name || '';
    return a.subject_name || a.subject_name_ar || '';
  }

  statusKey(status: string): string {
    return 'ENR_STATUS_' + (status || '').toUpperCase();
  }

  async archiveAll(): Promise<void> {
    const ok = confirm(this.translate.instant('ENR_HIST_ARCHIVE_ALL_CONFIRM'));
    if (!ok) return;
    const label = prompt(this.translate.instant('ENR_HIST_ARCHIVE_LABEL_PROMPT')) || undefined;
    try {
      const res = await this.edu.archiveAllLiveEnrollments({
        confirm: true,
        term_label: label,
        archive_note: 'Manual bulk archive',
      });
      this.snackbar.show(
        this.translate.instant('ENR_HIST_ARCHIVED', { n: res.data?.archived_count ?? 0 }),
        'success',
      );
      await this.bootstrap(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string }; message?: string })?.error?.message
      || (e as { message?: string })?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
