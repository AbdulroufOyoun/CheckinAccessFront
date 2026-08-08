import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BookingsService } from '../services/bookings.service';
import { UsersService, TenantUser } from '../services/users.service';
import { SnackbarService } from '../services/snackbar.service';
import {
  RoomOccupancyStatus,
  RoomPeriodAvailabilityPayload,
  RoomStatusItem,
  RoomStatusService,
} from '../services/room-status.service';
import { TimePicker } from '../shared/time-picker/time-picker';

type BookingMode = 'full_day' | 'hourly';
type WizardStep = 1 | 2 | 3;

interface WeekdayOption {
  code: number;
  labelKey: string;
}

@Component({
  selector: 'app-booking-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TimePicker],
  templateUrl: './booking-create-page.html',
  styleUrl: './booking-create-page.css',
})
export class BookingCreatePage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly bookingsApi = inject(BookingsService);
  private readonly roomStatusApi = inject(RoomStatusService);
  private readonly usersApi = inject(UsersService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  saving = false;
  loadingLists = true;
  loadingRooms = false;
  /** Background validate + rooms fetch while still on step 1. */
  roomsPrefetching = false;
  today = '';

  step: WizardStep = 1;
  users: TenantUser[] = [];
  buildings: Array<{ id: number; name: string }> = [];

  mode: BookingMode = 'full_day';
  form = {
    user_id: '' as number | '',
    room_id: '' as number | '',
    check_in_date: '',
    check_out_date: '',
    start_time: '09:00',
    end_time: '17:00',
    weekends_included: true,
    gregorian_holidays_included: true,
    islamic_holidays_included: true,
    excluded_weekdays: [] as number[],
  };

  availability: RoomPeriodAvailabilityPayload | null = null;
  selectedRoom: RoomStatusItem | null = null;
  blockedCount = 0;
  accessibleDays = 0;

  buildingFilter: number | null = null;
  roomSearch = '';
  statusFilter: 'available' | 'all' = 'available';

  readonly weekdays: WeekdayOption[] = [
    { code: 0, labelKey: 'BOOK_DAY_SUN' },
    { code: 1, labelKey: 'BOOK_DAY_MON' },
    { code: 2, labelKey: 'BOOK_DAY_TUE' },
    { code: 3, labelKey: 'BOOK_DAY_WED' },
    { code: 4, labelKey: 'BOOK_DAY_THU' },
    { code: 5, labelKey: 'BOOK_DAY_FRI' },
    { code: 6, labelKey: 'BOOK_DAY_SAT' },
  ];

  private prefetchTimer: ReturnType<typeof setTimeout> | null = null;
  private prefetchToken = 0;
  private roomsCacheKey: string | null = null;
  private prefetchPromise: Promise<boolean> | null = null;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.today = this.localIsoDate();
    this.form.check_in_date = this.today;
    this.form.check_out_date = this.today;
    void this.loadLists();
  }

  ngOnDestroy(): void {
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
    this.prefetchToken++;
  }

  get minCheckOut(): string {
    return this.form.check_in_date && this.form.check_in_date > this.today
      ? this.form.check_in_date
      : this.today;
  }

  get maxCheckIn(): string | null {
    return this.form.check_out_date || null;
  }

  get timeInvalid(): boolean {
    return this.mode === 'hourly'
      && !!this.form.start_time
      && !!this.form.end_time
      && this.form.end_time <= this.form.start_time;
  }

  get timeDurationLabel(): string {
    if (this.mode !== 'hourly' || !this.form.start_time || !this.form.end_time) return '';
    if (this.timeInvalid) return '';
    const mins = this.minutesBetween(this.form.start_time, this.form.end_time);
    if (mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) {
      return this.translate.instant('BOOK_DURATION_HM', { h, m });
    }
    if (h > 0) {
      return this.translate.instant('BOOK_DURATION_H', { h });
    }
    return this.translate.instant('BOOK_DURATION_M', { m });
  }

  get canGoStep2(): boolean {
    if (!this.form.user_id) return false;
    if (!this.form.check_in_date || !this.form.check_out_date) return false;
    if (this.form.check_in_date < this.today) return false;
    if (this.form.check_out_date < this.form.check_in_date) return false;
    if (this.mode === 'hourly') {
      if (!this.form.start_time || !this.form.end_time) return false;
      if (this.form.end_time <= this.form.start_time) return false;
    }
    return true;
  }

  /** Prefetched rooms match the current step-1 criteria. */
  get roomsReady(): boolean {
    return (
      this.roomsCacheKey === this.buildRoomsQueryKey() &&
      !!this.availability &&
      this.accessibleDays > 0
    );
  }

  get canGoStep3(): boolean {
    return !!this.selectedRoom && this.selectedRoom.status === 'available';
  }

  get canSave(): boolean {
    return this.canGoStep2 && this.canGoStep3;
  }

  get guestName(): string {
    const user = this.users.find((u) => u.id === this.form.user_id);
    return user?.name || '—';
  }

  get guestContact(): string {
    const user = this.users.find((u) => u.id === this.form.user_id);
    if (!user) return '';
    return user.email || user.mobile || '';
  }

  get guestInitials(): string {
    const name = this.guestName.trim();
    if (!name || name === '—') return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  get modeLabelKey(): string {
    return this.mode === 'hourly' ? 'BOOK_MODE_HOURLY' : 'BOOK_MODE_FULL';
  }

  get excludedDayLabels(): string[] {
    return this.form.excluded_weekdays
      .map((code) => this.weekdays.find((d) => d.code === code)?.labelKey)
      .filter((k): k is string => !!k);
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return value;
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(this.isRTL ? 'ar-SA' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  get filteredRooms(): RoomStatusItem[] {
    const rooms = this.availability?.rooms || [];
    const q = this.roomSearch.trim().toLowerCase();
    return rooms.filter((room) => {
      if (this.statusFilter === 'available' && room.status !== 'available') return false;
      if (this.buildingFilter && room.building?.id !== this.buildingFilter) return false;
      if (!q) return true;
      const hay = [room.number, room.name, room.room_type?.name, room.building?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  get summary() {
    return (
      this.availability?.summary || {
        total: 0,
        available: 0,
        occupied: 0,
        inactive: 0,
      }
    );
  }

  setMode(mode: BookingMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.scheduleRoomsPrefetch();
  }

  onGuestChange(): void {
    this.scheduleRoomsPrefetch();
  }

  onCheckInChange(): void {
    this.normalizeCheckIn(true);
    this.scheduleRoomsPrefetch();
  }

  onCheckOutChange(): void {
    this.normalizeCheckOut(true);
    this.scheduleRoomsPrefetch();
  }

  onTimeChange(): void {
    this.scheduleRoomsPrefetch();
    this.cdr.detectChanges();
  }

  onAccessRulesChange(): void {
    this.scheduleRoomsPrefetch();
  }

  toggleExcludedDay(code: number): void {
    if (this.form.excluded_weekdays.includes(code)) {
      this.form.excluded_weekdays = this.form.excluded_weekdays.filter((c) => c !== code);
    } else {
      this.form.excluded_weekdays = [...this.form.excluded_weekdays, code];
    }
    this.scheduleRoomsPrefetch();
  }

  isExcludedDay(code: number): boolean {
    return this.form.excluded_weekdays.includes(code);
  }

  cancel(): void {
    if (this.saving) return;
    void this.router.navigate(['/Reservations']);
  }

  back(): void {
    if (this.saving || this.step === 1) return;
    this.step = (this.step - 1) as WizardStep;
  }

  async goToRooms(): Promise<void> {
    this.normalizeCheckIn(true);
    this.normalizeCheckOut(true);
    if (!this.canGoStep2) {
      this.snackbar.show(
        this.form.check_in_date < this.today
          ? this.translate.instant('BOOK_DATE_NOT_PAST')
          : this.form.check_out_date < this.form.check_in_date
            ? this.translate.instant('BOOK_DATE_END_BEFORE_START')
            : this.translate.instant('BOOK_REQUIRED'),
        'error',
      );
      return;
    }

    if (this.roomsReady) {
      this.step = 2;
      this.cdr.detectChanges();
      return;
    }

    // Prefer an in-flight background prefetch for the same criteria.
    if (this.roomsPrefetching && this.prefetchPromise) {
      this.loadingRooms = true;
      this.cdr.detectChanges();
      try {
        const ok = await this.prefetchPromise;
        if (ok && this.roomsReady) {
          this.step = 2;
          return;
        }
      } finally {
        this.loadingRooms = false;
        this.cdr.detectChanges();
      }
    }

    this.loadingRooms = true;
    this.selectedRoom = null;
    this.form.room_id = '';
    this.cdr.detectChanges();
    try {
      const ok = await this.fetchRoomsForCurrentCriteria({ notifyEmpty: true });
      if (ok) {
        this.step = 2;
      }
    } finally {
      this.loadingRooms = false;
      this.cdr.detectChanges();
    }
  }

  async reloadRooms(): Promise<void> {
    if (this.step !== 2 || this.loadingRooms) return;
    this.loadingRooms = true;
    this.selectedRoom = null;
    this.form.room_id = '';
    try {
      await this.loadRoomAvailability();
      this.roomsCacheKey = this.buildRoomsQueryKey();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loadingRooms = false;
      this.cdr.detectChanges();
    }
  }

  /** Debounced background fetch once step-1 fields are complete. */
  scheduleRoomsPrefetch(): void {
    if (this.step !== 1) return;
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
    if (!this.canGoStep2) {
      this.prefetchToken++;
      this.prefetchPromise = null;
      this.roomsCacheKey = null;
      this.roomsPrefetching = false;
      this.cdr.detectChanges();
      return;
    }
    const key = this.buildRoomsQueryKey();
    if (key === this.roomsCacheKey && this.availability && this.accessibleDays > 0) {
      return;
    }
    this.prefetchToken++;
    this.prefetchPromise = null;
    this.roomsCacheKey = null;
    this.roomsPrefetching = false;
    this.prefetchTimer = setTimeout(() => {
      this.prefetchTimer = null;
      void this.prefetchRooms();
    }, 400);
  }

  private normalizeCheckIn(showToast: boolean): void {
    if (!this.form.check_in_date || this.form.check_in_date < this.today) {
      this.form.check_in_date = this.today;
      if (showToast) {
        this.snackbar.show(this.translate.instant('BOOK_DATE_NOT_PAST'), 'error');
      }
    }
    if (this.form.check_out_date && this.form.check_out_date < this.form.check_in_date) {
      this.form.check_out_date = this.form.check_in_date;
    }
  }

  private normalizeCheckOut(showToast: boolean): void {
    const minOut = this.minCheckOut;
    if (!this.form.check_out_date || this.form.check_out_date < minOut) {
      this.form.check_out_date = minOut;
      if (showToast) {
        this.snackbar.show(this.translate.instant('BOOK_DATE_END_BEFORE_START'), 'error');
      }
    }
  }

  private async prefetchRooms(): Promise<void> {
    if (this.step !== 1 || !this.canGoStep2) return;
    if (this.roomsReady) return;
    await this.fetchRoomsForCurrentCriteria({ notifyEmpty: false, background: true });
  }

  private async fetchRoomsForCurrentCriteria(options: {
    notifyEmpty: boolean;
    background?: boolean;
  }): Promise<boolean> {
    const key = this.buildRoomsQueryKey();
    if (this.roomsCacheKey === key && this.availability && this.accessibleDays > 0) {
      return true;
    }

    const token = ++this.prefetchToken;
    if (options.background) {
      this.roomsPrefetching = true;
      this.cdr.detectChanges();
    }

    const run = async (): Promise<boolean> => {
      try {
        this.selectedRoom = null;
        this.form.room_id = '';

        const timed = this.mode === 'hourly';
        const periodTimes = timed
          ? [
              {
                start_time: this.toHms(this.form.start_time),
                end_time: this.toHms(this.form.end_time),
              },
            ]
          : undefined;

        const validation = await this.bookingsApi.validateAvailability({
          check_in_date: this.form.check_in_date,
          check_out_date: this.form.check_out_date,
          weekends_included: this.form.weekends_included,
          gregorian_holidays_included: this.form.gregorian_holidays_included,
          islamic_holidays_included: this.form.islamic_holidays_included,
          excluded_weekdays: this.form.excluded_weekdays,
          time_scheduled: timed,
          period_times: periodTimes,
        });

        if (token !== this.prefetchToken) return false;

        this.blockedCount = validation.data?.blocked_dates?.length || 0;
        this.accessibleDays = validation.data?.accessible_days ?? 0;

        if (this.accessibleDays <= 0) {
          this.availability = null;
          this.roomsCacheKey = null;
          if (options.notifyEmpty) {
            this.snackbar.show(this.translate.instant('BOOK_NO_ACCESSIBLE_DAYS'), 'error');
          }
          return false;
        }

        await this.loadRoomAvailability();
        if (token !== this.prefetchToken) return false;

        this.roomsCacheKey = key;
        return true;
      } catch (e: unknown) {
        if (token !== this.prefetchToken) return false;
        this.roomsCacheKey = null;
        if (!options.background || options.notifyEmpty) {
          this.snackbar.show(this.err(e), 'error');
        }
        return false;
      } finally {
        if (token === this.prefetchToken && options.background) {
          this.roomsPrefetching = false;
          this.cdr.detectChanges();
        }
      }
    };

    this.prefetchPromise = run();
    return this.prefetchPromise;
  }

  private buildRoomsQueryKey(): string {
    return JSON.stringify({
      user: this.form.user_id,
      in: this.form.check_in_date,
      out: this.form.check_out_date,
      mode: this.mode,
      start: this.form.start_time,
      end: this.form.end_time,
      weekends: this.form.weekends_included,
      greg: this.form.gregorian_holidays_included,
      isl: this.form.islamic_holidays_included,
      excl: [...this.form.excluded_weekdays].sort((a, b) => a - b),
    });
  }

  selectRoom(room: RoomStatusItem): void {
    if (room.status !== 'available') {
      this.snackbar.show(this.translate.instant('BOOK_ROOM_OCCUPIED_HINT'), 'error');
      return;
    }
    this.selectedRoom = room;
    this.form.room_id = room.id;
  }

  goConfirm(): void {
    if (!this.canGoStep3) {
      this.snackbar.show(this.translate.instant('BOOK_PICK_ROOM'), 'error');
      return;
    }
    this.step = 3;
  }

  statusLabel(status: RoomOccupancyStatus): string {
    const map: Record<string, string> = {
      available: 'ROOM_STATUS_AVAILABLE',
      occupied: 'ROOM_STATUS_OCCUPIED',
      on_hold: 'ROOM_STATUS_ON_HOLD',
      inactive: 'ROOM_STATUS_INACTIVE',
    };
    return this.translate.instant(map[status] || status);
  }

  async save(): Promise<void> {
    if (!this.canSave || this.saving) {
      this.snackbar.show(this.translate.instant('BOOK_REQUIRED'), 'error');
      return;
    }

    const timed = this.mode === 'hourly';
    const period: Record<string, unknown> = {
      check_in_date: this.form.check_in_date,
      check_out_date: this.form.check_out_date,
      time_scheduled: timed,
      weekends_included: this.form.weekends_included,
      gregorian_holidays_included: this.form.gregorian_holidays_included,
      islamic_holidays_included: this.form.islamic_holidays_included,
      excluded_weekdays: this.form.excluded_weekdays,
      units: [
        {
          unit_type: 'room',
          unit_id: Number(this.form.room_id),
          sequential: false,
          sub_units_included: false,
        },
      ],
    };

    if (timed) {
      period['period_times'] = [
        {
          start_time: this.toHms(this.form.start_time),
          end_time: this.toHms(this.form.end_time),
        },
      ];
    }

    this.saving = true;
    try {
      const availability = await this.bookingsApi.validateAvailability({
        check_in_date: this.form.check_in_date,
        check_out_date: this.form.check_out_date,
        weekends_included: this.form.weekends_included,
        gregorian_holidays_included: this.form.gregorian_holidays_included,
        islamic_holidays_included: this.form.islamic_holidays_included,
        excluded_weekdays: this.form.excluded_weekdays,
        time_scheduled: timed,
        period_times: timed ? period['period_times'] : undefined,
        units: period['units'],
      });

      if (!availability.data?.available) {
        const msg =
          availability.data?.overlap_errors?.[0]
          || (availability.data?.accessible_days === 0
            ? this.translate.instant('BOOK_NO_ACCESSIBLE_DAYS')
            : this.translate.instant('BOOK_NOT_AVAILABLE'));
        this.snackbar.show(msg, 'error');
        return;
      }

      this.blockedCount = availability.data?.blocked_dates?.length || 0;
      this.accessibleDays = availability.data?.accessible_days ?? this.accessibleDays;

      await this.bookingsApi.create({
        bookings: [
          {
            user_id: Number(this.form.user_id),
            booking_periods: [period as never],
          },
        ],
      });

      this.snackbar.show(this.translate.instant('BOOK_CREATED'), 'success');
      void this.router.navigate(['/Reservations']);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private async loadRoomAvailability(): Promise<void> {
    const timed = this.mode === 'hourly';
    this.availability = await this.roomStatusApi.getAvailabilityForPeriod({
      check_in_date: this.form.check_in_date,
      check_out_date: this.form.check_out_date,
      time_scheduled: timed,
      period_times: timed
        ? [
            {
              start_time: this.toHms(this.form.start_time),
              end_time: this.toHms(this.form.end_time),
            },
          ]
        : undefined,
      building_id: this.buildingFilter,
    });
  }

  private async loadLists(): Promise<void> {
    this.loadingLists = true;
    try {
      const [usersPage, buildings] = await Promise.all([
        this.usersApi.list(200),
        this.roomStatusApi.getFilterBuildings(),
      ]);
      this.users = usersPage.data || [];
      this.buildings = buildings.map((b) => ({ id: b.id, name: b.name }));
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.loadingLists = false;
      this.cdr.detectChanges();
    }
  }

  private localIsoDate(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private minutesBetween(start: string, end: string): number {
    const toMin = (v: string) => {
      const [hh, mm] = v.split(':').map(Number);
      return (hh || 0) * 60 + (mm || 0);
    };
    return toMin(end) - toMin(start);
  }

  private toHms(value: string): string {
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
    return value;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
