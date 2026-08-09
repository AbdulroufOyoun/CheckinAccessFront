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
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

interface SimpleUser {
  id: number;
  name?: string;
  email?: string;
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
  filtered: EduEnrollmentRow[] = [];
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

  sectionLabel(sec?: EduSection | null): string {
    if (!sec) return '';
    const subj = this.subjectLabel(sec.subject);
    return subj ? `${subj} — ${sec.number}` : String(sec.number);
  }

  studentLabel(row: EduEnrollmentRow): string {
    return row.user?.name || row.user?.email || `#${row.enrollment.user_id}`;
  }

  statusKey(status: string): string {
    return 'ENR_STATUS_' + (status || '').toUpperCase();
  }

  statusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'edu-ui__badge--on';
      case 'dropped':
        return 'edu-ui__badge--off';
      default:
        return 'edu-ui__badge--lab';
    }
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
    this.applyFilter();
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.rows.filter((row) => {
      const matchStatus = !this.statusFilter || row.enrollment.status === this.statusFilter;
      if (!matchStatus) return false;
      if (!q) return true;
      const student = this.studentLabel(row).toLowerCase();
      const section = String(row.enrollment.section?.number || row.enrollment.section_id).toLowerCase();
      const subject = this.subjectLabel(row.enrollment.section?.subject).toLowerCase();
      const status = (row.enrollment.status || '').toLowerCase();
      return student.includes(q) || section.includes(q) || subject.includes(q) || status.includes(q);
    });
  }

  onStatusFilterChange(): void {
    this.applyFilter();
  }

  async openCreate(): Promise<void> {
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
      data: { users, terms },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.bootstrap(true);
    });
  }

  async setStatus(id: number, status: string): Promise<void> {
    try {
      await this.edu.updateEnrollmentStatus(id, status);
      this.snackbar.show(this.translate.instant('ENR_STATUS_UPDATED'), 'success');
      const row = this.rows.find((r) => r.enrollment.id === id);
      if (row) {
        row.enrollment.status = status;
        this.applyFilter();
        this.cdr.detectChanges();
      } else {
        await this.bootstrap(true);
      }
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async remove(row: EduEnrollmentRow): Promise<void> {
    const ok = confirm(
      this.translate.instant('ENR_DELETE_CONFIRM', { name: this.studentLabel(row) }),
    );
    if (!ok) return;
    try {
      await this.edu.removeEnrollment(row.enrollment.id);
      this.snackbar.show(this.translate.instant('ENR_DELETED'), 'success');
      this.rows = this.rows.filter((r) => r.enrollment.id !== row.enrollment.id);
      this.applyFilter();
      this.cdr.detectChanges();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
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
