import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogMobileService } from '../../services/dialog-mobile.service';
import {
  Booking,
  BookingPeriod,
  BookingUnit,
  BookingsService,
} from '../../services/bookings.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';
import { BookingDetailDialog } from '../../dialog/booking-detail/booking-detail';

interface DeletedReservationRow {
  id: number;
  guestName: string;
  unitLabel: string;
  building: string;
  checkIn: string;
  checkOut: string;
  scheduleLabel: string;
  deletedAt: string;
  statusKey: string;
  raw: Booking;
}

@Component({
  selector: 'app-deleted-reservations-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './deleted-reservations-page.html',
  styleUrls: [
    '../reservations-page-component/reservations-page-component.css',
    './deleted-reservations-page.css',
  ],
})
export class DeletedReservationsPageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly bookingsApi = inject(BookingsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly dialogMobile = inject(DialogMobileService);

  readonly perPage = 20;

  loading = true;
  isRTL = false;
  search = '';
  reservations: DeletedReservationRow[] = [];
  total = 0;
  currentPage = 1;
  lastPage = 1;
  pageFrom = 0;
  pageTo = 0;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  backToList(): void {
    void this.router.navigate(['/Reservations']);
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

  formatDateTime(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(this.isRTL ? 'ar-SA' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  get hasFilters(): boolean {
    return !!this.search.trim();
  }

  openDetails(row: DeletedReservationRow): void {
    this.dialogMobile.open(BookingDetailDialog, {
      panelClass: ['custom-dialog'],
      width: '560px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      data: { bookingId: row.id, preview: row.raw },
    });
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const res = await this.bookingsApi.listDeleted({
        per_page: this.perPage,
        page: this.currentPage,
        q: this.search.trim() || undefined,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      this.reservations = rows.map((b) => this.toRow(b));
      this.total = res.total ?? rows.length;
      this.currentPage = res.current_page ?? this.currentPage;
      this.lastPage = Math.max(res.last_page ?? 1, 1);
      this.pageFrom = res.from ?? (rows.length ? (this.currentPage - 1) * this.perPage + 1 : 0);
      this.pageTo = res.to ?? (rows.length ? this.pageFrom + rows.length - 1 : 0);
    } catch (e: unknown) {
      this.reservations = [];
      this.total = 0;
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private toRow(b: Booking): DeletedReservationRow {
    const periods = b.booking_periods || b.bookingPeriods || [];
    const units = b.booking_period_units || b.bookingPeriodUnits || [];
    const period = periods[0];
    const unit = units[0];
    const times = this.periodTimes(period);
    const timed = !!(period?.time_scheduled) && times.length > 0;

    let statusKey = 'BOOK_STATUS_ACTIVE';
    if (b.cancelled) statusKey = 'BOOK_STATUS_CANCELLED';
    else if (b.on_hold) statusKey = 'BOOK_STATUS_PAUSED';

    return {
      id: b.id,
      guestName: b.user?.name || `#${b.user_id}`,
      unitLabel: this.unitLabel(unit),
      building: this.buildingLabel(unit),
      checkIn: period?.check_in_date || '—',
      checkOut: period?.check_out_date || '—',
      scheduleLabel: timed
        ? times.map((t) => `${this.fmtTime(t.start_time)}–${this.fmtTime(t.end_time)}`).join(', ')
        : this.translate.instant('BOOK_FULL_DAY'),
      deletedAt: b.deleted_at || '—',
      statusKey,
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
    return unit.building?.name || unit.room?.floor?.building?.name || '—';
  }

  private fmtTime(value?: string): string {
    if (!value) return '';
    const m = String(value).match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : value;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
