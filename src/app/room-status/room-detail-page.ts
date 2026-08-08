import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../services/snackbar.service';
import {
  RoomDetail,
  RoomOccupancyStatus,
  RoomStatusItem,
  RoomStatusService,
} from '../services/room-status.service';
import { Booking, BookingPeriod, BookingsService } from '../services/bookings.service';
import { ApiService } from '../services/api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

interface UnlockRow {
  id?: number;
  user_name?: string | null;
  user_id?: number | null;
  created_at?: string | null;
  room_number?: string | null;
}

interface BookingRow {
  id: number;
  guest: string;
  email: string;
  mobile: string;
  checkIn: string;
  checkOut: string;
  schedule: string;
  status: 'active' | 'paused' | 'cancelled';
  statusKey: string;
  raw: Booking;
}

@Component({
  selector: 'app-room-detail-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, PageSkeleton],
  templateUrl: './room-detail-page.html',
  styleUrl: './room-detail-page.css',
})
export class RoomDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly roomsApi = inject(RoomStatusService);
  private readonly bookingsApi = inject(BookingsService);
  private readonly api = inject(ApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  loading = true;
  roomId = 0;
  date = '';
  time = '';

  room: RoomDetail | null = null;
  statusSnapshot: RoomStatusItem | null = null;
  bookings: BookingRow[] = [];
  unlocks: UnlockRow[] = [];
  unlocksAvailable = true;
  highlightLockId: number | null = null;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });

    this.route.paramMap.subscribe((params) => {
      this.roomId = Number(params.get('id') || 0);
      const q = this.route.snapshot.queryParamMap;
      this.date = q.get('date') || this.toDateInput(new Date());
      this.time = q.get('time') || this.toTimeInput(new Date());
      this.highlightLockId = Number(q.get('lock') || 0) || null;
      void this.load();
    });
  }

  isHighlightedLock(id?: number): boolean {
    return !!this.highlightLockId && !!id && this.highlightLockId === id;
  }

  get status(): RoomOccupancyStatus {
    return this.statusSnapshot?.status || (this.room?.active === false || this.room?.active === 0 ? 'inactive' : 'available');
  }

  get statusLabel(): string {
    const map: Record<RoomOccupancyStatus, string> = {
      available: 'ROOM_STATUS_AVAILABLE',
      occupied: 'ROOM_STATUS_OCCUPIED',
      on_hold: 'ROOM_STATUS_ON_HOLD',
      inactive: 'ROOM_STATUS_INACTIVE',
    };
    return this.translate.instant(map[this.status]);
  }

  get locationLabel(): string {
    const building =
      this.room?.floor?.building?.name ||
      this.statusSnapshot?.building?.name ||
      '—';
    const floor =
      this.room?.floor?.number != null
        ? `${this.translate.instant('ROOM_STATUS_FLOOR')} ${this.room.floor.number}`
        : this.statusSnapshot?.floor
          ? `${this.translate.instant('ROOM_STATUS_FLOOR')} ${this.statusSnapshot.floor.number}`
          : '—';
    const suite =
      this.room?.suite?.name ||
      this.room?.suite?.number ||
      this.statusSnapshot?.suite?.name ||
      this.statusSnapshot?.suite?.number ||
      '';
    return suite ? `${building} · ${floor} · ${suite}` : `${building} · ${floor}`;
  }

  get roomTitle(): string {
    const num = this.room?.number || this.statusSnapshot?.number || `#${this.roomId}`;
    return `${this.translate.instant('ROOM_DETAIL_ROOM')} ${num}`;
  }

  get roomTypeName(): string {
    return (
      this.room?.room_type?.name ||
      this.room?.roomType?.name ||
      this.statusSnapshot?.room_type?.name ||
      '—'
    );
  }

  get activeBookings(): number {
    return this.bookings.filter((b) => b.status === 'active').length;
  }

  get occupancyPct(): number {
    const cap = Number(this.room?.capacity || this.statusSnapshot?.capacity || 0);
    if (!cap) return this.activeBookings > 0 ? 100 : 0;
    return Math.min(100, Math.round((this.activeBookings / cap) * 100));
  }

  goBack(): void {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigate(['/RoomStatus']);
  }

  openReservation(id: number): void {
    void this.router.navigate(['/Reservations'], { queryParams: { highlight: id } });
  }

  async load(): Promise<void> {
    if (!this.roomId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    try {
      const [roomRes, bookingsPage, statusPayload] = await Promise.all([
        this.roomsApi.getRoomDetail(this.roomId),
        this.bookingsApi.listByUnit('room', this.roomId, 100),
        this.roomsApi.getStatus({
          date: this.date,
          time: this.time,
          building_id: null,
          floor_id: null,
          suite_id: null,
        }).catch(() => null),
      ]);

      this.room = roomRes?.data || null;
      this.bookings = (bookingsPage.data || []).map((b) => this.toBookingRow(b));
      this.statusSnapshot =
        statusPayload?.rooms?.find((r) => r.id === this.roomId) || null;

      try {
        const unlockRes = await this.api.get<ApiResponse<{ data?: UnlockRow[] } | UnlockRow[]>>(
          `${Apiendpointd.doorUnlockHistoryByRoom(this.roomId)}?per_page=20`,
        );
        const raw = unlockRes?.data;
        this.unlocks = Array.isArray(raw) ? raw : (raw?.data || []);
        this.unlocksAvailable = true;
      } catch {
        this.unlocks = [];
        this.unlocksAvailable = false;
      }
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'),
        'error',
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
      if (this.highlightLockId) {
        queueMicrotask(() => {
          this.document.getElementById('rd-lock-focus')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        });
      }
    }
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString(this.isRTL ? 'ar-SA' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  formatDateTime(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(this.isRTL ? 'ar-SA' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private toBookingRow(b: Booking): BookingRow {
    const periods = b.booking_periods || b.bookingPeriods || [];
    const period = periods[0];
    const status: BookingRow['status'] = b.cancelled
      ? 'cancelled'
      : b.on_hold
        ? 'paused'
        : 'active';
    return {
      id: b.id,
      guest: b.user?.name || this.translate.instant('ROOM_STATUS_GUEST_UNKNOWN'),
      email: b.user?.email || '—',
      mobile: b.user?.mobile || '—',
      checkIn: this.formatDate(period?.check_in_date),
      checkOut: this.formatDate(period?.check_out_date),
      schedule: this.scheduleLabel(period),
      status,
      statusKey:
        status === 'cancelled'
          ? 'ROOM_DETAIL_BOOKING_CANCELLED'
          : status === 'paused'
            ? 'ROOM_DETAIL_BOOKING_HOLD'
            : 'ROOM_DETAIL_BOOKING_ACTIVE',
      raw: b,
    };
  }

  private scheduleLabel(period?: BookingPeriod): string {
    if (!period) return '—';
    if (!period.time_scheduled) return this.translate.instant('ROOM_DETAIL_FULL_DAY');
    const times = period.period_times || period.periodTimes || [];
    if (!times.length) return this.translate.instant('ROOM_STATUS_HOURLY');
    return times
      .map((t) => `${String(t.start_time).slice(0, 5)}–${String(t.end_time).slice(0, 5)}`)
      .join(', ');
  }

  private toDateInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toTimeInput(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}
