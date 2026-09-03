import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../services/snackbar.service';
import {
  RoomClassSlot,
  RoomDetail,
  RoomOccupancyStatus,
  RoomStatusBooking,
  RoomStatusItem,
  RoomStatusSchedule,
  RoomStatusService,
} from '../services/room-status.service';
import { Booking, BookingPeriod, BookingsService } from '../services/bookings.service';
import { ApiService } from '../services/api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import { RealtimeService } from '../services/realtime.service';

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

interface LectureDayGroup {
  dayId: number;
  dayName: string;
  isToday: boolean;
  slots: RoomClassSlot[];
}

@Component({
  selector: 'app-room-detail-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, PageSkeleton],
  templateUrl: './room-detail-page.html',
  styleUrl: './room-detail-page.css',
})
export class RoomDetailPage implements OnInit, OnDestroy {
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
  private readonly realtime = inject(RealtimeService);
  private readonly destroy$ = new Subject<void>();

  isRTL = false;
  loading = true;
  roomId = 0;
  date = '';
  time = '';

  room: RoomDetail | null = null;
  statusSnapshot: RoomStatusItem | null = null;
  bookings: BookingRow[] = [];
  lectures: RoomClassSlot[] = [];
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
    this.realtime.occupancyChanged.pipe(takeUntil(this.destroy$)).subscribe((payload) => {
      if (this.realtime.affectsRoom(payload, this.roomId)) {
        void this.load();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    const used = this.statusSnapshot?.used_capacity;
    if (cap > 0 && used != null) {
      return Math.min(100, Math.round((used / cap) * 100));
    }
    if (!cap) return this.activeBookings > 0 ? 100 : 0;
    return Math.min(100, Math.round((this.activeBookings / cap) * 100));
  }

  get occupyingSchedule(): RoomStatusSchedule | null {
    return this.statusSnapshot?.schedule || null;
  }

  get occupyingBooking(): RoomStatusBooking | null {
    return this.statusSnapshot?.booking || null;
  }

  get occupyingNow(): boolean {
    return this.status === 'occupied' || this.status === 'on_hold';
  }

  get lectureDays(): LectureDayGroup[] {
    const groups = new Map<number, LectureDayGroup>();
    for (const slot of this.lectures) {
      let group = groups.get(slot.day_id);
      if (!group) {
        group = {
          dayId: slot.day_id,
          dayName: this.dayLabel(slot.day_name),
          isToday: !!slot.is_today,
          slots: [],
        };
        groups.set(slot.day_id, group);
      }
      group.slots.push(slot);
    }
    return [...groups.values()];
  }

  scheduleNowLabel(): string {
    return this.scheduleSlotLabel(this.occupyingSchedule);
  }

  scheduleSlotLabel(schedule?: RoomStatusSchedule | null): string {
    if (!schedule) return '';
    const subject = this.isRTL
      ? (schedule.subject_ar || schedule.subject || '')
      : (schedule.subject || schedule.subject_ar || '');
    const section = schedule.section_number
      ? this.translate.instant('SCHED_SECTION', { n: schedule.section_number })
      : '';
    return [subject, section].filter(Boolean).join(' · ');
  }

  slotWindow(slot: RoomStatusSchedule): string {
    return [slot.start, slot.end].filter(Boolean).join(' – ');
  }

  isCurrentLecture(slot: RoomClassSlot): boolean {
    if (slot.covers_now) return true;
    const occupyingId = this.occupyingSchedule?.section_time_id;
    return !!occupyingId && occupyingId === slot.section_time_id;
  }

  private dayLabel(name?: string | null): string {
    const map: Record<string, string> = {
      Sunday: 'BOOK_DAY_SUN',
      Monday: 'BOOK_DAY_MON',
      Tuesday: 'BOOK_DAY_TUE',
      Wednesday: 'BOOK_DAY_WED',
      Thursday: 'BOOK_DAY_THU',
      Friday: 'BOOK_DAY_FRI',
      Saturday: 'BOOK_DAY_SAT',
    };
    const key = name ? map[name] : '';
    return key ? this.translate.instant(key) : name || '—';
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
      const [roomRes, bookingsPage, statusPayload, classesPayload] = await Promise.all([
        this.roomsApi.getRoomDetail(this.roomId),
        this.bookingsApi.listByUnit('room', this.roomId, 100),
        this.roomsApi.getStatus({
          date: this.date,
          time: this.time,
          building_id: null,
          floor_id: null,
          suite_id: null,
        }).catch(() => null),
        this.roomsApi
          .getRoomClasses(this.roomId, { date: this.date, time: this.time })
          .catch(() => null),
      ]);

      this.room = roomRes?.data || null;
      this.bookings = (bookingsPage.data || []).map((b) => this.toBookingRow(b));
      this.statusSnapshot =
        statusPayload?.rooms?.find((r) => r.id === this.roomId) || null;
      this.lectures = classesPayload?.classes || [];

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
