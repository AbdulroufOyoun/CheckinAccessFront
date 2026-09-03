import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AcademicTerm,
  EducationService,
  EduEnrollmentArchiveRow,
} from '../../services/education.service';
import { Apiendpointd } from '../../apiEndpoints';
import { ApiService } from '../../services/api.service';
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
export class EnrollmentHistoryPage implements OnInit, OnDestroy {
  private readonly edu = inject(EducationService);
  private readonly api = inject(ApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly perPage = 25;
  loading = false;
  initialLoad = true;
  isRTL = false;
  rows: EduEnrollmentArchiveRow[] = [];
  terms: AcademicTerm[] = [];
  users: SimpleUser[] = [];

  search = '';
  statusFilter = '';
  termFilter: number | null = null;
  userFilter: number | null = null;

  currentPage = 1;
  lastPage = 1;
  total = 0;
  pageFrom = 0;
  pageTo = 0;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private usersPromise: Promise<SimpleUser[]> | null = null;

  statuses = ['', 'enrolled', 'dropped', 'completed'] as const;

  get showSkeleton(): boolean {
    return this.initialLoad && this.rows.length === 0;
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    void this.loadUserOptions();
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  onFiltersChange(): void {
    this.currentPage = 1;
    void this.load();
  }

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.onFiltersChange(), 300);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(page, 1), this.lastPage || 1);
    if (next === this.currentPage) return;
    this.currentPage = next;
    void this.load();
  }

  async load(): Promise<void> {
    const hadData = this.rows.length > 0;
    if (!hadData) {
      this.loading = true;
    }
    try {
      const res = await this.edu.getEnrollmentHistoryPage({
        page: this.currentPage,
        per_page: this.perPage,
        q: this.search.trim() || undefined,
        status: this.statusFilter || undefined,
        academic_term_id: this.termFilter,
        user_id: this.userFilter,
      });
      this.rows = res.data;
      this.terms = res.terms;
      this.total = res.total;
      this.currentPage = res.current_page;
      this.lastPage = Math.max(res.last_page, 1);
      this.pageFrom = res.from ?? (this.rows.length ? (this.currentPage - 1) * this.perPage + 1 : 0);
      this.pageTo = res.to ?? this.pageFrom + this.rows.length - (this.rows.length ? 1 : 0);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
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
      this.currentPage = 1;
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private async loadUserOptions(): Promise<void> {
    if (this.users.length) return;
    if (this.usersPromise) {
      this.users = await this.usersPromise;
      return;
    }
    this.usersPromise = this.api
      .get<{ data: SimpleUser[] }>(`${Apiendpointd.users}?per_page=100`)
      .then((result) => {
        const list = Array.isArray(result.data) ? result.data : [];
        this.usersPromise = null;
        return list;
      })
      .catch(() => {
        this.usersPromise = null;
        return [] as SimpleUser[];
      });
    this.users = await this.usersPromise;
    this.cdr.detectChanges();
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string }; message?: string })?.error?.message
      || (e as { message?: string })?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
