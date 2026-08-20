import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AcademicTerm,
  EducationService,
  EduEnrollmentRow,
  EduSection,
  EduSubject,
} from '../../services/education.service';
import { EducationReferenceCache } from '../../services/education-reference-cache.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ApiService } from '../../services/api.service';
import { Apiendpointd } from '../../apiEndpoints';
import { AddEnrollment } from '../../dialog/add-enrollment/add-enrollment';
import { EnrollmentDetail } from '../../dialog/enrollment-detail/enrollment-detail';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

interface SimpleUser {
  id: number;
  name?: string;
  email?: string;
}

interface StudentEnrollmentGroup {
  userId: number;
  user?: { id: number; name?: string; email?: string } | null;
  rows: EduEnrollmentRow[];
}

@Component({
  selector: 'app-enrollments-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './enrollments-page.html',
  styleUrls: ['../education-shared.css', './enrollments-page.css'],
})
export class EnrollmentsPage implements OnInit {
  private readonly edu = inject(EducationService);
  private readonly pageCache = inject(EducationReferenceCache);
  private readonly snackbar = inject(SnackbarService);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  rows: EduEnrollmentRow[] = [];
  groups: StudentEnrollmentGroup[] = [];
  filtered: StudentEnrollmentGroup[] = [];
  sections: EduSection[] = [];
  terms: AcademicTerm[] = [];
  users: SimpleUser[] = [];
  loading = false;
  initialLoad = true;
  search = '';
  statusFilter = '';
  isRTL = false;

  private usersPromise: Promise<SimpleUser[]> | null = null;

  statuses = ['', 'enrolled', 'dropped', 'completed'] as const;

  get showSkeleton(): boolean {
    return this.initialLoad && this.rows.length === 0;
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.applyFilter();
      this.cdr.detectChanges();
    });
    const cached = this.pageCache.peekEnrollmentsPageBundle();
    if (cached) {
      this.applyBundle(cached);
      this.initialLoad = false;
    }
    void this.bootstrap();
  }

  subjectLabel(s?: EduSubject | null): string {
    if (!s) return '';
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  studentLabel(group: StudentEnrollmentGroup): string {
    return group.user?.name || group.user?.email || `#${group.userId}`;
  }

  statusKey(status: string): string {
    return 'ENR_STATUS_' + (status || '').toUpperCase();
  }

  async bootstrap(force = false): Promise<void> {
    const hadData = this.rows.length > 0;
    if (!hadData) {
      this.loading = true;
    }
    try {
      const bundle = await this.pageCache.getEnrollmentsPageBundle({
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

  private applyBundle(bundle: {
    enrollments?: EduEnrollmentRow[];
    sections?: EduSection[];
    terms?: AcademicTerm[];
  }): void {
    this.rows = bundle.enrollments || [];
    this.sections = bundle.sections || [];
    if (bundle.terms) {
      this.terms = bundle.terms;
    }
    this.rebuildGroups();
    this.applyFilter();
  }

  private rebuildGroups(): void {
    const map = new Map<number, StudentEnrollmentGroup>();
    for (const row of this.rows) {
      const userId = row.enrollment.user_id;
      const existing = map.get(userId);
      if (existing) {
        existing.rows.push(row);
        continue;
      }
      map.set(userId, {
        userId,
        user: row.user,
        rows: [row],
      });
    }
    this.groups = Array.from(map.values()).sort((a, b) =>
      this.studentLabel(a).localeCompare(this.studentLabel(b), this.isRTL ? 'ar' : 'en'),
    );
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.groups.filter((group) => {
      if (this.statusFilter && !group.rows.some((row) => row.enrollment.status === this.statusFilter)) {
        return false;
      }
      return this.groupMatchesSearch(group, q);
    });
  }

  private groupMatchesSearch(group: StudentEnrollmentGroup, q: string): boolean {
    if (!q) return true;
    if (this.studentLabel(group).toLowerCase().includes(q)) return true;
    return group.rows.some((row) => {
      const section = String(row.enrollment.section?.number || row.enrollment.section_id).toLowerCase();
      const subject = this.subjectLabel(row.enrollment.section?.subject).toLowerCase();
      const status = (row.enrollment.status || '').toLowerCase();
      return section.includes(q) || subject.includes(q) || status.includes(q);
    });
  }

  onStatusFilterChange(): void {
    this.applyFilter();
  }

  async openCreate(userId?: number): Promise<void> {
    const users = await this.loadUserOptions();
    let terms = this.terms;
    if (!terms.length) {
      try {
        const res = await this.edu.getAcademicTerms('open');
        terms = res.data || [];
        this.terms = terms;
      } catch {
        terms = [];
      }
    }

    const ref = this.dialog.open(AddEnrollment, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '640px',
      maxWidth: '94vw',
      data: { users, terms, userId },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.bootstrap(true);
    });
  }

  openDetails(group: StudentEnrollmentGroup): void {
    const ref = this.dialog.open(EnrollmentDetail, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '640px',
      maxWidth: '94vw',
      data: {
        userId: group.userId,
        user: group.user,
        rows: group.rows,
      },
    });
    ref.afterClosed().subscribe((result) => {
      if (result && typeof result === 'object' && 'edit' in result) {
        void this.openCreate(result.userId);
        return;
      }
      if (result) void this.bootstrap(true);
    });
  }

  private async loadUserOptions(): Promise<SimpleUser[]> {
    if (this.users.length) {
      return this.users;
    }
    if (this.usersPromise) {
      return this.usersPromise;
    }

    this.usersPromise = this.api
      .get<{ data: SimpleUser[] }>(`${Apiendpointd.users}?per_page=100`)
      .then((result) => {
        this.users = Array.isArray(result.data) ? result.data : [];
        this.usersPromise = null;
        return this.users;
      })
      .catch(() => {
        this.users = [];
        this.usersPromise = null;
        return this.users;
      });

    return this.usersPromise;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
