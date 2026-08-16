import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
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
export class ReservationsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly bookingsApi = inject(BookingsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);

  loading = true;
  isRTL = false;
  search = '';
  statusFilter = '';
  reservations: ReservationRow[] = [];
  filteredReservations: ReservationRow[] = [];

  statCounts = {
    all: 0,
    active: 0,
    paused: 0,
    cancelled: 0,
  };

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
        this.filterReservations();
        this.cdr.detectChanges();
      }
    });
    void this.load();
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
    this.statusFilter = status;
    this.filterReservations();
  }

  onSearchChange(): void {
    this.filterReservations();
  }

  filterReservations(): void {
    const q = this.search.trim().toLowerCase();
    this.filteredReservations = this.reservations.filter((r) => {
      const matchSearch =
        !q
        || r.guestName.toLowerCase().includes(q)
        || String(r.id).includes(q)
        || r.unitLabel.toLowerCase().includes(q)
        || r.building.toLowerCase().includes(q);
      const matchStatus = !this.statusFilter || r.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const res = await this.bookingsApi.list({ per_page: 100 });
      const rows = Array.isArray(res.data) ? res.data : [];
      this.reservations = rows.map((b) => this.toRow(b));
      this.updateStats();
      this.filterReservations();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  openNewReservation(): void {
    void this.router.navigate(['/Reservations/New']);
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
      data: { bookingId: row.id },
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
    const ok = confirm(this.translate.instant('BOOK_CANCEL_CONFIRM', { id: row.id }));
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
    const ok = confirm(this.translate.instant('BOOK_DELETE_CONFIRM', { id: row.id }));
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

  private updateStats(): void {
    this.statCounts = {
      all: this.reservations.length,
      active: this.reservations.filter((r) => r.status === 'active').length,
      paused: this.reservations.filter((r) => r.status === 'paused').length,
      cancelled: this.reservations.filter((r) => r.status === 'cancelled').length,
    };
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
