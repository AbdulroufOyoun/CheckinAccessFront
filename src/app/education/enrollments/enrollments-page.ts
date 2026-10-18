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

interface EnrollmentUser {
  id: number;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
}

interface SimpleUser extends EnrollmentUser {}

interface StudentEnrollmentGroup {
  userId: number;
  user: EnrollmentUser;
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

  /** Sort key and fallback label */
  studentLabel(group: StudentEnrollmentGroup): string {
    return this.studentPrimaryName(group);
  }

  studentPrimaryName(group: StudentEnrollmentGroup): string {
    const u = group.user;
    if (u.name?.trim()) return u.name.trim();
    if (u.email?.trim()) return u.email.trim();
    if (u.mobile?.trim()) return u.mobile.trim();
    return this.translate.instant('ENR_STUDENT_UNNAMED');
  }

  studentSecondaryLine(group: StudentEnrollmentGroup): string {
    const u = group.user;
    const idPart = this.translate.instant('ENR_STUDENT_ID', { id: group.userId });
    const parts: string[] = [idPart];
    const primary = this.studentPrimaryName(group);
    if (u.email?.trim() && u.email.trim() !== primary) {
      parts.push(u.email.trim());
    }
    if (u.mobile?.trim() && u.mobile.trim() !== primary) {
      parts.push(u.mobile.trim());
    }
    return parts.join(' · ');
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
      await this.loadUserOptions();
      this.enrichGroupsWithDirectoryUsers();
      this.applyFilter();
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
        existing.user = this.mergeEnrollmentUsers(existing.user, row.user);
        continue;
      }
      map.set(userId, {
        userId,
        user: this.normalizeEnrollmentUser(userId, row.user),
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
    const haystack = this.groupSearchHaystack(group);
    const qNorm = q.replace(/^#/, '').trim();
    if (haystack.includes(q)) return true;
    if (qNorm && qNorm !== q && haystack.includes(qNorm)) return true;
    return false;
  }

  private groupSearchHaystack(group: StudentEnrollmentGroup): string {
    const parts: string[] = [];
    const u = group.user;
    parts.push(String(group.userId), `#${group.userId}`);
    if (u.name) parts.push(u.name);
    if (u.email) parts.push(u.email);
    if (u.mobile) parts.push(u.mobile);
    parts.push(this.studentPrimaryName(group), this.studentSecondaryLine(group));

    for (const row of group.rows) {
      const e = row.enrollment;
      parts.push(String(e.id), String(e.section_id));
      if (e.status) {
        parts.push(e.status);
        parts.push(this.translate.instant(this.statusKey(e.status)));
      }
      if (e.enrolled_at) parts.push(e.enrolled_at);

      const sec = e.section;
      if (!sec) continue;

      parts.push(String(sec.id), String(sec.number ?? ''));
      if (sec.room_name) parts.push(sec.room_name);
      if (sec.room?.name) parts.push(sec.room.name);
      if (sec.room?.number) parts.push(String(sec.room.number));
      if (sec.doctor?.name) parts.push(sec.doctor.name);

      const sub = sec.subject;
      if (sub) {
        parts.push(sub.name, sub.name_ar ?? '', sub.short_name ?? '');
      }

      const term = sec.academic_term ?? sec.academicTerm;
      if (term) {
        parts.push(term.name, term.name_ar ?? '', String(term.id));
      }
    }

    return parts
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .join('\n')
      .toLowerCase();
  }

  private normalizeEnrollmentUser(
    userId: number,
    fromRow?: EduEnrollmentRow['user'] | null,
  ): EnrollmentUser {
    return this.mergeEnrollmentUsers(
      { id: userId, name: null, email: null, mobile: null },
      fromRow,
    );
  }

  private mergeEnrollmentUsers(
    base: EnrollmentUser,
    extra?: EduEnrollmentRow['user'] | null,
  ): EnrollmentUser {
    if (!extra) return base;
    return {
      id: base.id,
      name: base.name ?? extra.name ?? null,
      email: base.email ?? extra.email ?? null,
      mobile: base.mobile ?? extra.mobile ?? null,
    };
  }

  private enrichGroupsWithDirectoryUsers(): void {
    if (!this.users.length) return;
    const byId = new Map(this.users.map((u) => [u.id, u]));
    for (const group of this.groups) {
      const dir = byId.get(group.userId);
      if (!dir) continue;
      group.user = {
        id: group.userId,
        name: group.user.name ?? dir.name ?? null,
        email: group.user.email ?? dir.email ?? null,
        mobile: group.user.mobile ?? dir.mobile ?? null,
      };
    }
  }

  onStatusFilterChange(): void {
    this.applyFilter();
  }

  openCreate(userId?: number): void {
    void this.loadUserOptions();
    const ref = this.dialog.open(AddEnrollment, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '640px',
      maxWidth: '94vw',
      data: { users: this.users, terms: this.terms, userId },
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
