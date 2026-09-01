import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { CommonModule, DOCUMENT, Location } from '@angular/common';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Subscription } from 'rxjs';

import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

import { SnackbarService } from '../services/snackbar.service';

import { AuthService } from '../services/auth.service';

import { TenantUser, UsersService } from '../services/users.service';

import { AddUser } from '../dialog/add-user/add-user';

import { BookingDetailDialog } from '../dialog/booking-detail/booking-detail';

import { Booking, BookingUnit } from '../services/bookings.service';

import {

  EducationService,

  EduEnrollmentRow,

} from '../services/education.service';

import {

  EnrollmentDetail,

  EnrollmentDetailDialogData,

} from '../dialog/enrollment-detail/enrollment-detail';



interface BookingRow {

  id: number;

  status: string;

  statusKey: string;

  checkIn: string;

  checkOut: string;

  room: string;

  raw: Booking;

}



interface EnrollmentRow {

  id: number;

  subject: string;

  section: string;

  room: string;

  term: string;

  status: string;

  statusKey: string;

}



type BookingFilter = 'all' | 'active' | 'ended' | 'cancelled';



const AVATAR_PALETTE = [

  { color: '#2563EB', shadow: 'rgba(37,99,235,0.25)' },

  { color: '#0D9488', shadow: 'rgba(13,148,136,0.25)' },

  { color: '#7C3AED', shadow: 'rgba(124,58,237,0.25)' },

  { color: '#DB2777', shadow: 'rgba(219,39,119,0.25)' },

  { color: '#D97706', shadow: 'rgba(217,119,6,0.25)' },

  { color: '#DC2626', shadow: 'rgba(220,38,38,0.25)' },

];



const BOOKING_STATUS_ORDER: Record<string, number> = {

  active: 0,

  on_hold: 1,

  ended: 2,

  cancelled: 3,

};



@Component({

  selector: 'app-user-detail-page',

  standalone: true,

  imports: [CommonModule, TranslateModule, RouterLink, PageSkeleton],

  templateUrl: './user-detail-page.html',

  styleUrl: './user-detail-page.css',

})

export class UserDetailPage implements OnInit, OnDestroy {

  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly location = inject(Location);

  private readonly usersApi = inject(UsersService);

  private readonly educationApi = inject(EducationService);

  private readonly auth = inject(AuthService);

  private readonly snackbar = inject(SnackbarService);

  private readonly dialog = inject(MatDialog);

  private readonly translate = inject(TranslateService);

  private readonly cdr = inject(ChangeDetectorRef);

  private readonly document = inject(DOCUMENT);



  private sub?: Subscription;

  private loadSeq = 0;

  private enrollmentRowsRaw: EduEnrollmentRow[] = [];



  isRTL = false;

  loading = true;

  notFound = false;

  userId = 0;

  user: TenantUser | null = null;

  bookings: BookingRow[] = [];

  bookingsLoading = false;

  bookingFilter: BookingFilter = 'all';

  canSeeBookings = false;

  enrollments: EnrollmentRow[] = [];

  enrollmentsLoading = false;

  canSeeEnrollments = false;



  ngOnInit(): void {

    this.isRTL =

      this.document.documentElement.getAttribute('dir') === 'rtl' ||

      this.translate.getCurrentLang() === 'ar';

    this.translate.onLangChange.subscribe((e) => {

      this.isRTL = e.lang === 'ar';

      this.cdr.detectChanges();

    });



    this.canSeeBookings =

      this.auth.hasModule('property') && this.auth.can('manage bookings');

    this.canSeeEnrollments =

      this.auth.hasModule('education') && this.auth.can('manage enrollments');



    this.sub = this.route.paramMap.subscribe((params) => {

      this.userId = Number(params.get('id') || 0);

      void this.load();

    });

  }



  ngOnDestroy(): void {

    this.sub?.unsubscribe();

  }



  get isActive(): boolean {

    return this.user?.active === true || this.user?.active === 1;

  }



  get filteredBookings(): BookingRow[] {

    if (this.bookingFilter === 'all') {

      return this.bookings;

    }

    if (this.bookingFilter === 'active') {

      return this.bookings.filter((b) => b.status === 'active' || b.status === 'on_hold');

    }

    return this.bookings.filter((b) => b.status === this.bookingFilter);

  }



  get initials(): string {

    const parts = (this.user?.name || '?').trim().split(/\s+/).filter(Boolean);

    if (!parts.length) return '?';

    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (parts[0][0] + parts[1][0]).toUpperCase();

  }



  get avatarStyle(): { background: string; boxShadow: string } {

    const palette = AVATAR_PALETTE[(this.userId || 0) % AVATAR_PALETTE.length];

    return {

      background: palette.color,

      boxShadow: `0 8px 24px ${palette.shadow}`,

    };

  }



  get createdLabel(): string {

    if (!this.user?.created_at) return '—';

    try {

      return new Date(this.user.created_at).toLocaleDateString(

        this.isRTL ? 'ar' : 'en',

        { year: 'numeric', month: 'short', day: 'numeric' },

      );

    } catch {

      return this.user.created_at;

    }

  }



  setBookingFilter(filter: BookingFilter): void {

    this.bookingFilter = filter;

    this.cdr.detectChanges();

  }



  goBack(): void {

    if (window.history.length > 1) {

      this.location.back();

    } else {

      void this.router.navigate(['/Users']);

    }

  }



  openEdit(): void {

    if (!this.user) return;

    const ref = this.dialog.open(AddUser, {

      panelClass: ['custom-dialog', 'subject-dialog'],

      backdropClass: 'custom-backdrop',

      width: '560px',

      maxWidth: '94vw',

      data: { mode: 'edit', user: this.user },

    });

    ref.afterClosed().subscribe((changed) => {

      if (changed) void this.load({ force: true });

    });

  }



  openBookingDetails(row: BookingRow, event?: Event): void {

    event?.stopPropagation();

    this.dialog.open(BookingDetailDialog, {

      panelClass: ['custom-dialog'],

      backdropClass: 'custom-backdrop',

      width: '560px',

      maxWidth: '96vw',

      maxHeight: '92vh',

      autoFocus: false,

      data: { bookingId: row.id, preview: row.raw },

    });

  }



  openEnrollmentDetails(): void {

    if (!this.enrollmentRowsRaw.length) return;

    this.dialog.open(EnrollmentDetail, {

      panelClass: ['custom-dialog', 'subject-dialog'],

      backdropClass: 'custom-backdrop',

      width: '640px',

      maxWidth: '96vw',

      maxHeight: '92vh',

      autoFocus: false,

      data: {

        userId: this.userId,

        user: this.user,

        rows: this.enrollmentRowsRaw,

      } satisfies EnrollmentDetailDialogData,

    }).afterClosed().subscribe((result) => {

      if (result) void this.load({ force: true });

    });

  }



  async removeUser(): Promise<void> {

    if (!this.user) return;

    const ok = confirm(

      this.translate.instant('USR_REMOVE_CONFIRM', { name: this.user.name }),

    );

    if (!ok) return;

    try {

      await this.usersApi.remove(this.user.id);

      this.snackbar.show(this.translate.instant('USR_REMOVED'), 'success');

      void this.router.navigate(['/Users']);

    } catch (e: unknown) {

      this.snackbar.show(this.err(e), 'error');

    }

  }



  private async load(options?: { force?: boolean }): Promise<void> {

    if (!this.userId) {

      this.loading = false;

      this.notFound = true;

      this.cdr.detectChanges();

      return;

    }



    const seq = ++this.loadSeq;

    this.loading = true;

    this.notFound = false;

    this.cdr.detectChanges();



    try {

      const res = await this.usersApi.show(this.userId, options);

      if (seq !== this.loadSeq) return;



      this.user = res.data ?? null;

      if (!this.user) {

        this.notFound = true;

        return;

      }



      if (this.canSeeBookings) {

        void this.loadBookings(seq);

      } else {

        this.bookings = [];

      }



      if (this.canSeeEnrollments) {

        void this.loadEnrollments(seq);

      } else {

        this.enrollments = [];

        this.enrollmentRowsRaw = [];

      }

    } catch {

      if (seq !== this.loadSeq) return;

      this.user = null;

      this.notFound = true;

      this.snackbar.show(this.translate.instant('USR_DETAIL_NOT_FOUND'), 'error');

    } finally {

      if (seq === this.loadSeq) {

        this.loading = false;

        this.cdr.detectChanges();

      }

    }

  }



  private async loadBookings(seq: number): Promise<void> {

    this.bookingsLoading = true;

    this.cdr.detectChanges();

    try {

      const rows = await this.usersApi.userBookingsAll(this.userId);

      if (seq !== this.loadSeq) return;



      this.bookings = rows

        .map((raw) => this.toBookingRow(raw as Booking))

        .sort((a, b) => {

          const byStatus =

            (BOOKING_STATUS_ORDER[a.status] ?? 9) - (BOOKING_STATUS_ORDER[b.status] ?? 9);

          if (byStatus !== 0) return byStatus;

          return b.id - a.id;

        });

    } catch {

      if (seq !== this.loadSeq) return;

      this.bookings = [];

    } finally {

      if (seq === this.loadSeq) {

        this.bookingsLoading = false;

        this.cdr.detectChanges();

      }

    }

  }



  private async loadEnrollments(seq: number): Promise<void> {

    this.enrollmentsLoading = true;

    this.cdr.detectChanges();

    try {

      const res = await this.educationApi.getEnrollments({ user_id: this.userId });

      if (seq !== this.loadSeq) return;



      const rows = Array.isArray(res.data) ? res.data : [];

      this.enrollmentRowsRaw = rows;

      this.enrollments = rows.map((row) => this.toEnrollmentRow(row));

    } catch {

      if (seq !== this.loadSeq) return;

      this.enrollments = [];

      this.enrollmentRowsRaw = [];

    } finally {

      if (seq === this.loadSeq) {

        this.enrollmentsLoading = false;

        this.cdr.detectChanges();

      }

    }

  }



  private toBookingRow(b: Booking): BookingRow {

    const periods = b.booking_periods || b.bookingPeriods || [];

    const units = b.booking_period_units || b.bookingPeriodUnits || [];

    const period = periods[0];

    const unit = units[0];

    const today = new Date().toISOString().slice(0, 10);



    let status = 'active';

    let statusKey = 'USR_BOOKING_ACTIVE';

    if (b.cancelled) {

      status = 'cancelled';

      statusKey = 'USR_BOOKING_CANCELLED';

    } else if (b.on_hold) {

      status = 'on_hold';

      statusKey = 'USR_BOOKING_HOLD';

    } else if (period?.check_out_date && period.check_out_date < today) {

      status = 'ended';

      statusKey = 'USR_BOOKING_ENDED';

    }



    return {

      id: b.id,

      status,

      statusKey,

      checkIn: period?.check_in_date || '—',

      checkOut: period?.check_out_date || '—',

      room: this.unitLabel(unit),

      raw: b,

    };

  }



  private toEnrollmentRow(row: EduEnrollmentRow): EnrollmentRow {

    const enrollment = row.enrollment;

    const section = enrollment.section;

    const subject = section?.subject;

    const term = section?.academicTerm || section?.academic_term;

    const status = enrollment.status || 'enrolled';

    const subjectLabel =

      (this.isRTL ? subject?.name_ar || subject?.name : subject?.name || subject?.name_ar)

      || '—';



    return {

      id: enrollment.id,

      subject: subjectLabel,

      section: section?.number ? `#${section.number}` : '—',

      room: section?.room?.number || section?.room?.name || section?.room_name || '—',

      term: term?.name || term?.name_ar || '—',

      status,

      statusKey: this.enrollmentStatusKey(status),

    };

  }



  private enrollmentStatusKey(status: string): string {

    const key = `USR_ENR_STATUS_${status.toUpperCase()}`;

    const known = ['USR_ENR_STATUS_ENROLLED', 'USR_ENR_STATUS_DROPPED', 'USR_ENR_STATUS_WITHDRAWN'];

    return known.includes(key) ? key : 'USR_ENR_STATUS_ENROLLED';

  }



  private unitLabel(unit?: BookingUnit): string {

    if (!unit) return '—';

    if (unit.room) return unit.room.number || unit.room.name || `Room #${unit.room.id}`;

    const suite = (unit as BookingUnit & { suite?: { id: number; name?: string; number?: string } }).suite;

    if (suite) return suite.name || suite.number || `Suite #${suite.id}`;

    if (unit.suite_id) return `Suite #${unit.suite_id}`;

    if (unit.facility) return unit.facility.name || `Facility #${unit.facility.id}`;

    if (unit.building) return unit.building.name || `Building #${unit.building.id}`;

    if (unit.room_id) return `Room #${unit.room_id}`;

    return '—';

  }



  private err(e: unknown): string {

    const m = (e as { error?: { message?: string } })?.error?.message;

    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');

  }

}


