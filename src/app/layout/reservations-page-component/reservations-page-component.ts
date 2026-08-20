import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import {
  Booking,
  BookingPeriod,
  BookingUnit,
  BookingsService,
} from '../../services/bookings.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';
import { AssignBookingLocksDialog } from '../../dialog/assign-booking-locks/assign-booking-locks';
import { BookingDetailDialog } from '../../dialog/booking-detail/booking-detail';
import { ConfirmDialog } from '../../dialog/confirm-dialog/confirm-dialog';
import { firstValueFrom } from 'rxjs';
import { RealtimeService } from '../../services/realtime.service';

interface ReservationRow {
  id: number;
  guestName: string;
  unitLabel: string;
  building: string;
  checkIn: string;
  checkOut: string;
  scheduleLabel: string;
  timed: boolean;
  status: 'active' | 'paused' | 'cancelled';
  raw: Booking;
}

@Component({
  selector: 'app-reservations-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './reservations-page-component.html',
  styleUrls: ['./reservations-page-component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-5px)' })),
      ]),
    ]),
  ],
})
export class ReservationsPageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly bookingsApi = inject(BookingsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);
  private readonly realtime = inject(RealtimeService);
  private readonly destroy$ = new Subject<void>();

  readonly perPage = 20;

  loading = true;
  isRTL = false;
  search = '';
  statusFilter = '';
  reservations: ReservationRow[] = [];
  total = 0;
  currentPage = 1;
  lastPage = 1;
  pageFrom = 0;
  pageTo = 0;

  statCounts = {
    all: 0,
    active: 0,
    paused: 0,
    cancelled: 0,
    deleted: 0,
  };

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    this.search = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.route.queryParamMap.subscribe((params) => {
      const q = params.get('q') ?? '';
      if (q !== this.search) {
        this.search = q;
        this.currentPage = 1;
        void this.load();
      }
    });
    void this.load();
    this.realtime.occupancyChanged.pipe(takeUntil(this.destroy$)).subscribe(() => {
      void this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  guestInitials(name: string): string {
    const cleaned = (name || '').trim();
    if (!cleaned || cleaned.startsWith('#')) return '?';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatDate(value?: string | null): string {
    if (!value || value === '—') return '—';
    const raw = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return value;
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(this.isRTL ? 'ar-SA' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  setStatusFilter(status: string): void {
    if (this.statusFilter === status) return;
    this.statusFilter = status;
    this.currentPage = 1;
    void this.load();
  }

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      void this.load();
    }, 300);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(page, 1), this.lastPage || 1);
    if (next === this.currentPage) return;
    this.currentPage = next;
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const res = await this.bookingsApi.list({
        per_page: this.perPage,
        page: this.currentPage,
        status: this.apiStatus(),
        q: this.search.trim() || undefined,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      this.reservations = rows.map((b) => this.toRow(b));
      this.total = res.total ?? rows.length;
      this.currentPage = res.current_page ?? this.currentPage;
      this.lastPage = Math.max(res.last_page ?? 1, 1);
      this.pageFrom = res.from ?? (rows.length ? (this.currentPage - 1) * this.perPage + 1 : 0);
      this.pageTo = res.to ?? (rows.length ? this.pageFrom + rows.length - 1 : 0);
      if (res.counts) {
        this.statCounts = {
          all: res.counts.all ?? 0,
          active: res.counts.active ?? 0,
          paused: res.counts.paused ?? 0,
          cancelled: res.counts.cancelled ?? 0,
          deleted: res.counts.deleted ?? res.total_deleted ?? 0,
        };
      }
    } catch (e: unknown) {
      this.reservations = [];
      this.total = 0;
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  openNewReservation(): void {
    void this.router.navigate(['/Reservations/New']);
  }

  openDeletedReservations(): void {
    void this.router.navigate(['/Reservations/Deleted']);
  }

  openDetails(row: ReservationRow, event?: Event): void {
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

  async holdReservation(row: ReservationRow): Promise<void> {
    try {
      await this.bookingsApi.hold(row.id);
      this.snackbar.show(this.translate.instant('BOOK_HELD'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async resumeReservation(row: ReservationRow): Promise<void> {
    try {
      await this.bookingsApi.resume(row.id);
      this.snackbar.show(this.translate.instant('BOOK_RESUMED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async cancelReservation(row: ReservationRow): Promise<void> {
    const ok = await this.openCancelConfirm(row);
    if (!ok) return;
    try {
      await this.bookingsApi.cancel(row.id);
      this.snackbar.show(this.translate.instant('BOOK_CANCELLED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async deleteReservation(row: ReservationRow): Promise<void> {
    const ok = await this.openDeleteConfirm(row);
    if (!ok) return;
    try {
      await this.bookingsApi.remove(row.id);
      this.snackbar.show(this.translate.instant('BOOK_DELETED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  openAssignLocks(row: ReservationRow): void {
    this.dialog
      .open(AssignBookingLocksDialog, {
        panelClass: ['custom-dialog'],
        backdropClass: 'custom-backdrop',
        width: '480px',
        maxWidth: '94vw',
        maxHeight: '90vh',
        autoFocus: false,
        data: { bookingId: row.id, guestName: row.guestName },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) void this.load();
      });
  }

  get hasFilters(): boolean {
    return !!this.search.trim() || !!this.statusFilter;
  }

  private apiStatus(): string | undefined {
    if (this.statusFilter === 'active') return 'active';
    if (this.statusFilter === 'paused') return 'on_hold';
    if (this.statusFilter === 'cancelled') return 'cancelled';
    return undefined;
  }

  private toRow(b: Booking): ReservationRow {
    const periods = b.booking_periods || b.bookingPeriods || [];
    const units = b.booking_period_units || b.bookingPeriodUnits || [];
    const period = periods[0];
    const unit = units[0];

    let status: ReservationRow['status'] = 'active';
    if (b.cancelled) status = 'cancelled';
    else if (b.on_hold) status = 'paused';

    const times = this.periodTimes(period);
    const timed = !!(period?.time_scheduled) && times.length > 0;

    return {
      id: b.id,
      guestName: b.user?.name || `#${b.user_id}`,
      unitLabel: this.unitLabel(unit),
      building: this.buildingLabel(unit),
      checkIn: period?.check_in_date || '—',
      checkOut: period?.check_out_date || '—',
      timed,
      scheduleLabel: timed
        ? times.map((t) => `${this.fmtTime(t.start_time)}–${this.fmtTime(t.end_time)}`).join(', ')
        : this.translate.instant('BOOK_FULL_DAY'),
      status,
      raw: b,
    };
  }

  private periodTimes(period?: BookingPeriod): Array<{ start_time: string; end_time: string }> {
    if (!period) return [];
    return period.period_times || period.periodTimes || [];
  }

  private unitLabel(unit?: BookingUnit): string {
    if (!unit) return '—';
    if (unit.room) return unit.room.number || unit.room.name || `Room #${unit.room.id}`;
    if (unit.facility) return unit.facility.name || `Facility #${unit.facility.id}`;
    if (unit.building) return unit.building.name || `Building #${unit.building.id}`;
    if (unit.room_id) return `Room #${unit.room_id}`;
    return '—';
  }

  private buildingLabel(unit?: BookingUnit): string {
    if (!unit) return '—';
    return (
      unit.building?.name
      || unit.room?.floor?.building?.name
      || '—'
    );
  }

  private fmtTime(value?: string): string {
    if (!value) return '';
    const m = String(value).match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : value;
  }

  private async openCancelConfirm(row: ReservationRow): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '440px',
      maxWidth: '94vw',
      autoFocus: false,
      data: {
        variant: 'danger',
        titleKey: 'BOOK_CANCEL_DIALOG_TITLE',
        hintKey: 'BOOK_CANCEL_DIALOG_HINT',
        confirmKey: 'BOOK_CANCEL_DIALOG_CONFIRM',
        preview: {
          initials: this.guestInitials(row.guestName),
          title: row.guestName,
          subtitle: `#${row.id} · ${row.unitLabel}`,
          meta: [
            { labelKey: 'BOOK_CHECK_IN', value: this.formatDate(row.checkIn) },
            { labelKey: 'BOOK_CHECK_OUT', value: this.formatDate(row.checkOut) },
          ],
        },
      },
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private async openDeleteConfirm(row: ReservationRow): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '440px',
      maxWidth: '94vw',
      autoFocus: false,
      data: {
        variant: 'warning',
        titleKey: 'BOOK_DELETE_DIALOG_TITLE',
        messageKey: 'BOOK_DELETE_DIALOG_MESSAGE',
        messageParams: { id: row.id },
        hintKey: 'BOOK_DELETE_DIALOG_HINT',
        confirmKey: 'BOOK_DELETE_DIALOG_CONFIRM',
        preview: {
          initials: this.guestInitials(row.guestName),
          title: row.guestName,
          subtitle: `#${row.id} · ${row.unitLabel}`,
        },
      },
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
