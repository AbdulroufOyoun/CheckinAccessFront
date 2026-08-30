import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { BookingsService, CreateBookingPeriodPayload } from '../services/bookings.service';
import { UsersService, TenantUser } from '../services/users.service';
import { SnackbarService } from '../services/snackbar.service';
import {
  RoomOccupancyStatus,
  RoomPeriodAvailabilityPayload,
  RoomPeriodAvailabilityQuery,
  RoomStatusItem,
  RoomStatusService,
} from '../services/room-status.service';
import { TimePicker } from '../shared/time-picker/time-picker';
import { RealtimeService } from '../services/realtime.service';
import { DurationPreset, DurationsService } from '../services/durations.service';
import { BookingAccessExtras } from './booking-access-extras/booking-access-extras';
import { BookingExtraPick } from './booking-extra-unit';
import {
  BuildingRoomGroups,
  FloorRoomGroups,
  groupRoomsByBuildingFloor,
  suiteAvailableCount,
  SuiteRoomGroup,
} from '../shared/room-display-groups';

type BookingMode = 'full_day' | 'hourly';
type WizardStep = 1 | 2 | 3;

interface WeekdayOption {
  code: number;
  labelKey: string;
}

interface PeriodDraft {
  id: string;
  mode: BookingMode;
  check_in_date: string;
  check_out_date: string;
  start_time: string;
  end_time: string;
  weekends_included: boolean;
  gregorian_holidays_included: boolean;
  islamic_holidays_included: boolean;
  excluded_weekdays: number[];
}

@Component({
  selector: 'app-booking-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TimePicker, BookingAccessExtras],
  templateUrl: './booking-create-page.html',
  styleUrls: ['./booking-create-page.css', '../shared/room-suite-layout.css'],
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
  private readonly realtime = inject(RealtimeService);
  private readonly durationsApi = inject(DurationsService);
  private readonly destroy$ = new Subject<void>();

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
  periods: PeriodDraft[] = [];
  occupants: TenantUser[] = [];
  occupantQuery = '';
  accessExtras: BookingExtraPick[] = [];

  form = {};

  availability: RoomPeriodAvailabilityPayload | null = null;
  selectedRooms: RoomStatusItem[] = [];
  blockedCount = 0;
  accessibleDays = 0;
  saveError = '';

  buildingFilter: number | null = null;
  roomSearch = '';
  statusFilter: 'available' | 'all' = 'available';

  timePresets: DurationPreset[] = [];
  stayPresets: DurationPreset[] = [];

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
  private periodSeq = 1;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.today = this.localIsoDate();
    this.periods = [this.blankPeriod()];
    void this.loadLists();
    void this.loadDurations();
    this.realtime.occupancyChanged.pipe(takeUntil(this.destroy$)).subscribe(() => {
      void this.refreshRoomsFromOccupancy();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
    this.prefetchToken++;
  }

  minCheckOut(period: PeriodDraft): string {
    return period.check_in_date && period.check_in_date > this.today
      ? period.check_in_date
      : this.today;
  }

  maxCheckIn(period: PeriodDraft): string | null {
    return period.check_out_date || null;
  }

  periodTimeInvalid(period: PeriodDraft): boolean {
    return (
      period.mode === 'hourly' &&
      !!period.start_time &&
      !!period.end_time &&
      period.end_time <= period.start_time
    );
  }

  periodDurationLabel(period: PeriodDraft): string {
    if (period.mode !== 'hourly' || !period.start_time || !period.end_time) return '';
    if (this.periodTimeInvalid(period)) return '';
    const mins = this.minutesBetween(period.start_time, period.end_time);
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

  periodValid(period: PeriodDraft): boolean {
    if (!period.check_in_date || !period.check_out_date) return false;
    if (period.check_in_date < this.today) return false;
    if (period.check_out_date < period.check_in_date) return false;
    if (period.mode === 'hourly') {
      if (!period.start_time || !period.end_time) return false;
      if (period.end_time <= period.start_time) return false;
    }
    return true;
  }

  get canGoStep2(): boolean {
    return this.periods.length > 0 && this.periods.every((p) => this.periodValid(p));
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
    return this.selectedRooms.length > 0 && this.selectedRooms.every((r) => r.status === 'available');
  }

  get roomCapacity(): number {
    if (!this.selectedRooms.length) return 1;
    return this.selectedRooms.reduce((sum, room) => sum + Math.max(1, Number(room.capacity) || 1), 0);
  }

  get selectedRoomCount(): number {
    return this.selectedRooms.length;
  }

  isRoomSelected(roomId: number): boolean {
    return this.selectedRooms.some((r) => r.id === roomId);
  }

  clearSelectedRooms(): void {
    this.selectedRooms = [];
  }

  get canSave(): boolean {
    return (
      this.canGoStep2 &&
      this.canGoStep3 &&
      this.occupants.length >= 1 &&
      this.occupants.length <= this.roomCapacity
    );
  }

  get occupantHits(): TenantUser[] {
    const q = this.occupantQuery.trim().toLowerCase();
    const taken = new Set(this.occupants.map((u) => u.id));
    return this.users
      .filter((u) => !taken.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const hay = [u.name, u.email, u.mobile].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }

  excludedDayLabels(period: PeriodDraft): string[] {
    return period.excluded_weekdays
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
      const hay = [room.number, room.name, room.room_type?.name, room.building?.name, room.suite?.name, room.suite?.number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  get roomDisplayGroups(): BuildingRoomGroups[] {
    return groupRoomsByBuildingFloor(this.filteredRooms, {
      unknownBuilding: this.translate.instant('ROOM_STATUS_UNKNOWN_BUILDING'),
      floorPrefix: this.translate.instant('ROOM_STATUS_FLOOR'),
      noFloor: this.translate.instant('ROOM_STATUS_NO_FLOOR'),
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

  addPeriod(): void {
    const last = this.periods[this.periods.length - 1];
    this.periods = [...this.periods, this.blankPeriod(last)];
    this.scheduleRoomsPrefetch();
  }

  removePeriod(id: string): void {
    if (this.periods.length <= 1) return;
    this.periods = this.periods.filter((p) => p.id !== id);
    this.scheduleRoomsPrefetch();
  }

  setPeriodMode(period: PeriodDraft, mode: BookingMode): void {
    if (period.mode === mode) return;
    period.mode = mode;
    this.scheduleRoomsPrefetch();
  }

  onCheckInChange(period: PeriodDraft): void {
    this.normalizeCheckIn(period, true);
    this.scheduleRoomsPrefetch();
  }

  onCheckOutChange(period: PeriodDraft): void {
    this.normalizeCheckOut(period, true);
    this.scheduleRoomsPrefetch();
  }

  onTimeChange(): void {
    this.scheduleRoomsPrefetch();
    this.cdr.detectChanges();
  }

  applyTimePreset(period: PeriodDraft, preset: DurationPreset): void {
    if (!preset.start_time || !preset.end_time) return;
    if (period.mode !== 'hourly') {
      period.mode = 'hourly';
    }
    period.start_time = this.formatHm(preset.start_time);
    period.end_time = this.formatHm(preset.end_time);
    this.onTimeChange();
  }

  applyDaysPreset(period: PeriodDraft, preset: DurationPreset): void {
    if (!preset.days) return;
    this.normalizeCheckIn(period, false);
    period.check_out_date = this.addDaysInclusive(period.check_in_date, preset.days);
    this.normalizeCheckOut(period, false);
    this.scheduleRoomsPrefetch();
    this.cdr.detectChanges();
  }

  applyDateRangePreset(period: PeriodDraft, preset: DurationPreset): void {
    if (!preset.start_date || !preset.end_date) return;
    period.check_in_date = preset.start_date.slice(0, 10);
    period.check_out_date = preset.end_date.slice(0, 10);
    this.normalizeCheckIn(period, false);
    this.normalizeCheckOut(period, false);
    this.scheduleRoomsPrefetch();
    this.cdr.detectChanges();
  }

  applyStayPreset(period: PeriodDraft, preset: DurationPreset): void {
    if (preset.kind === 'date_range') {
      this.applyDateRangePreset(period, preset);
    } else {
      this.applyDaysPreset(period, preset);
    }
  }

  stayPresetLabel(preset: DurationPreset): string {
    if (preset.name?.trim()) return preset.name;
    if (preset.kind === 'date_range') {
      return `${preset.start_date?.slice(0, 10) ?? ''} – ${preset.end_date?.slice(0, 10) ?? ''}`;
    }
    return this.translate.instant('DUR_DAYS_VALUE', { n: preset.days ?? 0 });
  }

  presetTimeLabel(preset: DurationPreset): string {
    if (preset.name?.trim()) return preset.name;
    return `${this.formatHm(preset.start_time || '')}–${this.formatHm(preset.end_time || '')}`;
  }

  onAccessRulesChange(): void {
    this.scheduleRoomsPrefetch();
  }

  toggleExcludedDay(period: PeriodDraft, code: number): void {
    if (period.excluded_weekdays.includes(code)) {
      period.excluded_weekdays = period.excluded_weekdays.filter((c) => c !== code);
    } else {
      period.excluded_weekdays = [...period.excluded_weekdays, code];
    }
    this.scheduleRoomsPrefetch();
  }

  isExcludedDay(period: PeriodDraft, code: number): boolean {
    return period.excluded_weekdays.includes(code);
  }

  addOccupant(user: TenantUser): void {
    if (this.occupants.some((u) => u.id === user.id)) return;
    if (this.occupants.length >= this.roomCapacity) {
      this.snackbar.show(
        this.translate.instant('BOOK_OCCUPANT_FULL', { n: this.roomCapacity }),
        'error',
      );
      return;
    }
    this.occupants = [...this.occupants, user];
    this.occupantQuery = '';
  }

  removeOccupant(id: number): void {
    this.occupants = this.occupants.filter((u) => u.id !== id);
  }

  cancel(): void {
    if (this.saving) return;
    void this.router.navigate(['/Reservations']);
  }

  back(): void {
    if (this.saving || this.step === 1) return;
    this.saveError = '';
    this.step = (this.step - 1) as WizardStep;
  }

  async goToRooms(): Promise<void> {
    for (const period of this.periods) {
      this.normalizeCheckIn(period, true);
      this.normalizeCheckOut(period, true);
    }
    if (!this.canGoStep2) {
      this.snackbar.show(this.translate.instant('BOOK_REQUIRED'), 'error');
      return;
    }

    if (this.roomsReady) {
      this.step = 2;
      this.cdr.detectChanges();
      return;
    }

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
    this.clearSelectedRooms();
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
    this.clearSelectedRooms();
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

  toggleRoom(room: RoomStatusItem): void {
    if (room.status !== 'available') {
      const key = room.blocked_by === 'schedule' ? 'BOOK_ROOM_OCCUPIED_CLASS' : 'BOOK_ROOM_OCCUPIED_HINT';
      this.snackbar.show(this.translate.instant(key), 'error');
      return;
    }

    const idx = this.selectedRooms.findIndex((r) => r.id === room.id);
    if (idx >= 0) {
      this.selectedRooms = this.selectedRooms.filter((r) => r.id !== room.id);
    } else {
      this.selectedRooms = [...this.selectedRooms, room];
    }

    const cap = this.roomCapacity;
    if (this.occupants.length > cap) {
      this.occupants = this.occupants.slice(0, cap);
    }
  }

  goConfirm(): void {
    if (!this.canGoStep3) {
      this.snackbar.show(this.translate.instant('BOOK_PICK_ROOMS'), 'error');
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

  trackBuilding(_: number, g: BuildingRoomGroups): string {
    return String(g.buildingId ?? 'none');
  }

  trackFloor(_: number, f: FloorRoomGroups): string {
    return String(f.floorId ?? 'none');
  }

  trackSuite(_: number, s: SuiteRoomGroup): string {
    return String(s.suiteId);
  }

  suiteAvailabilityLabel(group: SuiteRoomGroup): string {
    const available = suiteAvailableCount(group);
    return this.translate.instant('ROOM_SUITE_AVAILABILITY', {
      available,
      total: group.rooms.length,
    });
  }

  async save(): Promise<void> {
    if (!this.canSave || this.saving) {
      this.showSaveError(
        this.occupants.length < 1
          ? this.translate.instant('BOOK_OCCUPANT_REQUIRED')
          : this.translate.instant('BOOK_REQUIRED'),
      );
      return;
    }

    const roomUnits = this.selectedRooms.map((room) => ({
      unit_type: 'room' as const,
      unit_id: room.id,
      sequential: false,
      sub_units_included: false,
    }));
    const extraUnits = this.accessExtras.map((x) => ({
      unit_type: x.unit_type,
      unit_id: x.unit_id,
      sequential: false,
      sub_units_included: false,
    }));
    const bookingPeriods = this.periods.map((period) =>
      this.toPeriodPayload(period, [...roomUnits, ...extraUnits]),
    );

    this.saveError = '';
    this.saving = true;
    this.cdr.detectChanges();
    try {
      await this.withTimeout(this.runCreate(bookingPeriods), 20_000);
      this.snackbar.show(this.translate.instant('BOOK_CREATED'), 'success');
      void this.router.navigate(['/Reservations']);
    } catch (e: unknown) {
      this.showSaveError(this.err(e));
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private async runCreate(bookingPeriods: CreateBookingPeriodPayload[]): Promise<void> {
    for (const period of bookingPeriods) {
      const availability = await this.bookingsApi.validateAvailability({
        check_in_date: period.check_in_date,
        check_out_date: period.check_out_date,
        weekends_included: period.weekends_included,
        gregorian_holidays_included: period.gregorian_holidays_included,
        islamic_holidays_included: period.islamic_holidays_included,
        excluded_weekdays: period.excluded_weekdays,
        time_scheduled: period.time_scheduled,
        period_times: period.period_times,
        units: period.units,
      });

      if (!availability.data?.available) {
        const msg =
          availability.data?.overlap_errors?.[0] ||
          (availability.data?.accessible_days === 0
            ? this.translate.instant('BOOK_NO_ACCESSIBLE_DAYS')
            : this.translate.instant('BOOK_NOT_AVAILABLE'));
        throw new Error(msg);
      }
    }

    const occupantIds = this.occupants.map((u) => u.id);
    const res = await this.bookingsApi.create({
      bookings: [
        {
          user_id: occupantIds[0],
          occupant_user_ids: occupantIds,
          booking_periods: bookingPeriods,
        },
      ],
    });

    if (!res || (res as { success?: boolean }).success === false) {
      throw res;
    }
  }

  private blankPeriod(from?: PeriodDraft): PeriodDraft {
    return {
      id: `p-${this.periodSeq++}`,
      mode: from?.mode || 'full_day',
      check_in_date: from?.check_out_date || this.today,
      check_out_date: from?.check_out_date || this.today,
      start_time: from?.start_time || '09:00',
      end_time: from?.end_time || '17:00',
      weekends_included: from?.weekends_included ?? true,
      gregorian_holidays_included: from?.gregorian_holidays_included ?? true,
      islamic_holidays_included: from?.islamic_holidays_included ?? true,
      excluded_weekdays: [...(from?.excluded_weekdays || [])],
    };
  }

  private normalizeCheckIn(period: PeriodDraft, showToast: boolean): void {
    if (!period.check_in_date || period.check_in_date < this.today) {
      period.check_in_date = this.today;
      if (showToast) {
        this.snackbar.show(this.translate.instant('BOOK_DATE_NOT_PAST'), 'error');
      }
    }
    if (period.check_out_date && period.check_out_date < period.check_in_date) {
      period.check_out_date = period.check_in_date;
    }
  }

  private normalizeCheckOut(period: PeriodDraft, showToast: boolean): void {
    const minOut = this.minCheckOut(period);
    if (!period.check_out_date || period.check_out_date < minOut) {
      period.check_out_date = minOut;
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

  private async refreshRoomsFromOccupancy(): Promise<void> {
    if (!this.canGoStep2) return;
    const selectedIds = this.selectedRooms.map((r) => r.id);
    this.roomsCacheKey = null;
    const ok = await this.fetchRoomsForCurrentCriteria({
      notifyEmpty: false,
      background: this.step !== 2,
      preserveSelection: selectedIds.length ? selectedIds : null,
    });
    if (!ok || !selectedIds.length) return;

    const kept = (this.availability?.rooms || []).filter(
      (r) => selectedIds.includes(r.id) && r.status === 'available',
    );
    this.selectedRooms = kept;
    this.cdr.detectChanges();
  }

  private async fetchRoomsForCurrentCriteria(options: {
    notifyEmpty: boolean;
    background?: boolean;
    preserveSelection?: number[] | null;
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
        if (!options.preserveSelection?.length) {
          this.clearSelectedRooms();
        }

        const blocked = new Set<string>();
        let accessible = 0;

        for (const period of this.periods) {
          const timed = period.mode === 'hourly';
          const validation = await this.bookingsApi.validateAvailability({
            check_in_date: period.check_in_date,
            check_out_date: period.check_out_date,
            weekends_included: period.weekends_included,
            gregorian_holidays_included: period.gregorian_holidays_included,
            islamic_holidays_included: period.islamic_holidays_included,
            excluded_weekdays: period.excluded_weekdays,
            time_scheduled: timed,
            period_times: timed
              ? [{ start_time: this.toHms(period.start_time), end_time: this.toHms(period.end_time) }]
              : undefined,
          });

          if (token !== this.prefetchToken) return false;

          for (const row of validation.data?.blocked_dates || []) {
            if (row.date) blocked.add(row.date);
          }
          accessible += validation.data?.accessible_days ?? 0;

          if ((validation.data?.accessible_days ?? 0) <= 0) {
            this.availability = null;
            this.roomsCacheKey = null;
            this.blockedCount = blocked.size;
            this.accessibleDays = 0;
            if (options.notifyEmpty) {
              this.snackbar.show(this.translate.instant('BOOK_NO_ACCESSIBLE_DAYS'), 'error');
            }
            return false;
          }
        }

        this.blockedCount = blocked.size;
        this.accessibleDays = accessible;

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
        if (token === this.prefetchToken) {
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
      periods: this.periods.map((p) => ({
        in: p.check_in_date,
        out: p.check_out_date,
        mode: p.mode,
        start: p.start_time,
        end: p.end_time,
        weekends: p.weekends_included,
        greg: p.gregorian_holidays_included,
        isl: p.islamic_holidays_included,
        excl: [...p.excluded_weekdays].sort((a, b) => a - b),
      })),
      building: this.buildingFilter,
    });
  }

  private async loadRoomAvailability(): Promise<void> {
    const results = await Promise.all(
      this.periods.map((period) => this.roomStatusApi.getAvailabilityForPeriod(this.toAvailabilityQuery(period))),
    );
    this.availability = this.mergePeriodAvailability(results);
  }

  private toAvailabilityQuery(period: PeriodDraft): RoomPeriodAvailabilityQuery {
    const timed = period.mode === 'hourly';
    return {
      check_in_date: period.check_in_date,
      check_out_date: period.check_out_date,
      time_scheduled: timed,
      period_times: timed
        ? [{ start_time: this.toHms(period.start_time), end_time: this.toHms(period.end_time) }]
        : undefined,
      building_id: this.buildingFilter,
    };
  }

  private mergePeriodAvailability(results: RoomPeriodAvailabilityPayload[]): RoomPeriodAvailabilityPayload {
    const first = results[0];
    const byId = new Map<number, RoomStatusItem[]>();
    for (const result of results) {
      for (const room of result.rooms || []) {
        const list = byId.get(room.id) || [];
        list.push(room);
        byId.set(room.id, list);
      }
    }

    const rooms: RoomStatusItem[] = [];
    for (const variants of byId.values()) {
      const base = { ...variants[0] };
      if (variants.some((v) => v.status === 'inactive' || v.active === false)) {
        base.status = 'inactive';
      } else if (variants.length === results.length && variants.every((v) => v.status === 'available')) {
        base.status = 'available';
        base.blocked_by = null;
      } else {
        base.status = variants.some((v) => v.status === 'on_hold') ? 'on_hold' : 'occupied';
        base.blocked_by = variants.find((v) => v.blocked_by)?.blocked_by || 'booking';
      }
      rooms.push(base);
    }

    const summary = {
      total: rooms.length,
      available: rooms.filter((r) => r.status === 'available').length,
      occupied: rooms.filter((r) => r.status === 'occupied' || r.status === 'on_hold').length,
      inactive: rooms.filter((r) => r.status === 'inactive').length,
    };

    return {
      check_in_date: first?.check_in_date || '',
      check_out_date: first?.check_out_date || '',
      time_scheduled: first?.time_scheduled || false,
      summary,
      rooms: rooms.sort((a, b) => String(a.number).localeCompare(String(b.number))),
    };
  }

  onAccessExtrasChange(picks: BookingExtraPick[]): void {
    this.accessExtras = picks;
    this.cdr.detectChanges();
  }

  private toPeriodPayload(
    period: PeriodDraft,
    units: CreateBookingPeriodPayload['units'],
  ): CreateBookingPeriodPayload {
    const timed = period.mode === 'hourly';
    const payload: CreateBookingPeriodPayload = {
      check_in_date: period.check_in_date,
      check_out_date: period.check_out_date,
      time_scheduled: timed,
      weekends_included: period.weekends_included,
      gregorian_holidays_included: period.gregorian_holidays_included,
      islamic_holidays_included: period.islamic_holidays_included,
      excluded_weekdays: period.excluded_weekdays,
      units,
    };
    if (timed) {
      payload.period_times = [
        { start_time: this.toHms(period.start_time), end_time: this.toHms(period.end_time) },
      ];
    }
    return payload;
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

  private showSaveError(message: string): void {
    this.saveError = message;
    this.snackbar.show(message, 'error');
    this.cdr.detectChanges();
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' }));
          }, ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private err(e: unknown): string {
    if ((e as { code?: string })?.code === 'TIMEOUT' || (e as Error)?.message === 'TIMEOUT') {
      return this.translate.instant('BOOK_CREATE_TIMEOUT');
    }

    const http = e as {
      status?: number;
      message?: string;
      error?: string | {
        message?: string;
        data?: { errors?: Record<string, string[] | string> };
      };
    };

    const errBody = typeof http.error === 'object' && http.error ? http.error : null;
    const validation = this.firstValidationError(errBody?.data?.errors);
    const envelope =
      typeof http.error === 'string' && http.error.trim() && !http.error.includes('<')
        ? http.error.trim()
        : '';
    const raw =
      (typeof errBody?.message === 'string' && errBody.message) ||
      validation ||
      envelope ||
      (typeof http.message === 'string' && !http.message.startsWith('Http failure') && http.message) ||
      '';

    if (!raw || raw.length > 280 || raw.includes('<html')) {
      return this.translate.instant('BOOK_CREATE_FAILED');
    }

    const lower = raw.toLowerCase();
    if (
      lower.includes('sqlstate') ||
      lower.includes('lock wait') ||
      lower.includes('deadlock') ||
      lower.includes('try restarting transaction')
    ) {
      return this.translate.instant('BOOK_CREATE_FAILED');
    }

    return raw;
  }

  private firstValidationError(errors?: Record<string, string[] | string>): string {
    if (!errors || typeof errors !== 'object') return '';
    for (const value of Object.values(errors)) {
      if (typeof value === 'string' && value.trim()) return value;
      if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0];
    }
    return '';
  }

  private async loadDurations(): Promise<void> {
    try {
      const [timeRes, stayRes] = await Promise.all([
        this.durationsApi.list({ scope: 'property', kind: 'time', activeOnly: true }),
        this.durationsApi.list({ scope: 'property', kind: 'stay', activeOnly: true }),
      ]);
      this.timePresets = timeRes.data || [];
      this.stayPresets = stayRes.data || [];
    } catch {
      this.timePresets = [];
      this.stayPresets = [];
    }
    this.cdr.detectChanges();
  }

  private formatHm(value: string): string {
    const m = String(value).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : value;
  }

  private addDaysInclusive(iso: string, days: number): string {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + Math.max(1, days) - 1);
    return d.toISOString().slice(0, 10);
  }
}
