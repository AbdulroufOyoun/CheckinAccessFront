import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Booking,
  BookingOccupant,
  BookingOccupantEvent,
  BookingPeriod,
  BookingUnit,
  BookingsService,
} from '../../services/bookings.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ApiService } from '../../services/api.service';
import { Apiendpointd } from '../../apiEndpoints';
import { ApiResponse } from '../../interfaces/api-response';
import { TenantUser, UsersService } from '../../services/users.service';

export interface BookingDetailDialogData {
  bookingId: number;
  preview?: Booking | null;
}

@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TranslateModule],
  templateUrl: './booking-detail.html',
  styleUrl: './booking-detail.css',
})
export class BookingDetailDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BookingDetailDialog>);
  readonly data = inject<BookingDetailDialogData>(MAT_DIALOG_DATA);
  private readonly bookings = inject(BookingsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly usersApi = inject(UsersService);

  loading = true;
  navigating = false;
  occupantBusy = false;
  isRTL = false;
  booking: Booking | null = null;
  users: TenantUser[] = [];
  occupantQuery = '';

  private readonly weekdayKeys = [
    'BOOK_DETAIL_WD_SUN',
    'BOOK_DETAIL_WD_MON',
    'BOOK_DETAIL_WD_TUE',
    'BOOK_DETAIL_WD_WED',
    'BOOK_DETAIL_WD_THU',
    'BOOK_DETAIL_WD_FRI',
    'BOOK_DETAIL_WD_SAT',
  ];

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.booking = this.data.preview ?? null;
    this.loading = !this.booking;
    void this.load();
    void this.loadUsers();
  }

  get status(): 'active' | 'paused' | 'cancelled' {
    if (!this.booking) return 'active';
    if (this.booking.cancelled) return 'cancelled';
    if (this.booking.on_hold) return 'paused';
    return 'active';
  }

  get occupants(): BookingOccupant[] {
    return this.booking?.occupants || [];
  }

  get occupantEvents(): BookingOccupantEvent[] {
    return this.booking?.occupant_events || this.booking?.occupantEvents || [];
  }

  get roomCapacity(): number {
    return Math.max(1, Number(this.booking?.room_capacity) || 1);
  }

  get activeOccupants(): BookingOccupant[] {
    return this.occupants.filter((o) => o.status === 'active');
  }

  get canEditOccupants(): boolean {
    return this.status === 'active';
  }

  get occupantHits(): TenantUser[] {
    const q = this.occupantQuery.trim().toLowerCase();
    const taken = new Set(this.activeOccupants.map((o) => o.user_id));
    return this.users
      .filter((u) => !taken.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const hay = [u.name, u.email, u.mobile].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 6);
  }

  get periods(): BookingPeriod[] {
    return this.booking?.booking_periods || this.booking?.bookingPeriods || [];
  }

  get units(): BookingUnit[] {
    return this.booking?.booking_period_units || this.booking?.bookingPeriodUnits || [];
  }

  get locks(): Array<{ id: number; lockName?: string; lockAlias?: string; lockMac?: string }> {
    return this.booking?.locks || [];
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return String(value);
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return String(value);
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

  fmtTime(value?: string): string {
    if (!value) return '';
    const m = String(value).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : value;
  }

  unitRoomId(unit: BookingUnit): number | null {
    const id = unit.room?.id ?? unit.room_id;
    return id ? Number(id) : null;
  }

  unitClickable(unit: BookingUnit): boolean {
    return (
      this.unitRoomId(unit) != null ||
      !!(unit.building?.id || unit.building_id) ||
      !!(unit.facility?.id || unit.facility_id)
    );
  }

  unitLabel(unit: BookingUnit): string {
    if (unit.room) return unit.room.number || unit.room.name || `Room #${unit.room.id}`;
    if (unit.facility) return unit.facility.name || `Facility #${unit.facility.id}`;
    if (unit.building) return unit.building.name || `Building #${unit.building.id}`;
    if (unit.room_id) return `Room #${unit.room_id}`;
    return '—';
  }

  buildingLabel(unit: BookingUnit): string {
    return unit.building?.name || unit.room?.floor?.building?.name || '';
  }

  periodTimes(period: BookingPeriod): Array<{ start_time: string; end_time: string }> {
    return period.period_times || period.periodTimes || [];
  }

  excludedWeekdays(period: BookingPeriod): string {
    const rows =
      (
        period as BookingPeriod & {
          excluded_weekdays?: Array<{ weekday: number }>;
          excludedWeekdays?: Array<{ weekday: number }>;
        }
      ).excluded_weekdays ||
      (period as BookingPeriod & { excludedWeekdays?: Array<{ weekday: number }> }).excludedWeekdays ||
      [];
    if (!rows.length) return this.translate.instant('BOOK_DETAIL_NO_EXCLUSIONS');
    return rows
      .map((r) => this.translate.instant(this.weekdayKeys[r.weekday] || 'BOOK_DETAIL_WD_SUN'))
      .join(' · ');
  }

  lockLabel(lock: { id: number; lockName?: string; lockAlias?: string; lockMac?: string }): string {
    return lock.lockAlias || lock.lockName || lock.lockMac || `#${lock.id}`;
  }

  inclusionFlags(period: BookingPeriod): string[] {
    const flags: string[] = [];
    if (period.weekends_included) flags.push(this.translate.instant('BOOK_DETAIL_WEEKENDS'));
    if (period.gregorian_holidays_included) flags.push(this.translate.instant('BOOK_DETAIL_GREG_HOL'));
    if (period.islamic_holidays_included) flags.push(this.translate.instant('BOOK_DETAIL_ISL_HOL'));
    return flags;
  }

  async goToUnit(unit: BookingUnit): Promise<void> {
    if (this.navigating || !this.unitClickable(unit)) return;
    const roomId = this.unitRoomId(unit);
    if (roomId) {
      await this.navigateAway(['/RoomStatus', roomId]);
      return;
    }
    const buildingId = unit.building?.id ?? unit.building_id;
    if (buildingId) {
      await this.navigateAway(['/Property'], { type: 'building', id: buildingId });
      return;
    }
    const facilityId = unit.facility?.id ?? unit.facility_id;
    if (facilityId) {
      await this.navigateAway(['/Property'], { type: 'facility', id: facilityId });
    }
  }

  async goToLock(lock: { id: number }): Promise<void> {
    if (this.navigating || !lock?.id) return;

    const bookingRoomId = this.units.map((u) => this.unitRoomId(u)).find((id) => !!id) || null;
    if (bookingRoomId) {
      await this.navigateAway(['/RoomStatus', bookingRoomId], { lock: lock.id });
      return;
    }

    try {
      const res = await this.api.get<ApiResponse<{ rooms?: Array<{ id: number }> }>>(
        Apiendpointd.lockById(lock.id),
      );
      const roomId = res.data?.rooms?.[0]?.id;
      if (roomId) {
        await this.navigateAway(['/RoomStatus', roomId], { lock: lock.id });
        return;
      }
    } catch {
      /* fall through */
    }

    await this.navigateAway(['/Property'], { lock: lock.id, tab: 'locks' });
  }

  occupantName(row: { user?: { name?: string } | null; user_id: number }): string {
    return row.user?.name || `#${row.user_id}`;
  }

  eventLabel(event: string): string {
    const map: Record<string, string> = {
      added: 'BOOK_DETAIL_EVENT_ADDED',
      withdrawn: 'BOOK_DETAIL_EVENT_WITHDRAWN',
      reinstated: 'BOOK_DETAIL_EVENT_REINSTATED',
    };
    return this.translate.instant(map[event] || event);
  }

  roomLabelFromMeta(meta?: Record<string, unknown> | null): string {
    const label = meta?.['label'];
    return typeof label === 'string' && label ? label : '';
  }

  async addPerson(user: TenantUser): Promise<void> {
    if (!this.canEditOccupants || this.occupantBusy) return;
    this.occupantBusy = true;
    try {
      const res = await this.bookings.addOccupant(this.data.bookingId, user.id);
      this.booking = res.data || this.booking;
      this.occupantQuery = '';
      this.snackbar.show(this.translate.instant('BOOK_OCCUPANT_ADDED'), 'success');
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.occupantBusy = false;
      this.cdr.detectChanges();
    }
  }

  async withdrawPerson(occupant: BookingOccupant): Promise<void> {
    if (!this.canEditOccupants || this.occupantBusy || occupant.status !== 'active') return;
    this.occupantBusy = true;
    try {
      const res = await this.bookings.withdrawOccupant(this.data.bookingId, occupant.user_id);
      this.booking = res.data || this.booking;
      this.snackbar.show(this.translate.instant('BOOK_OCCUPANT_WITHDRAWN'), 'success');
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.occupantBusy = false;
      this.cdr.detectChanges();
    }
  }

  async reinstatePerson(occupant: BookingOccupant): Promise<void> {
    if (!this.canEditOccupants || this.occupantBusy) return;
    await this.addPerson({
      id: occupant.user_id,
      name: occupant.user?.name || `#${occupant.user_id}`,
      email: occupant.user?.email || '',
      mobile: occupant.user?.mobile || '',
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  private async navigateAway(
    commands: Array<string | number>,
    queryParams?: Record<string, string | number>,
  ): Promise<void> {
    this.navigating = true;
    this.dialogRef.close();
    try {
      await this.router.navigate(commands, queryParams ? { queryParams } : undefined);
    } finally {
      this.navigating = false;
    }
  }

  private async load(): Promise<void> {
    const hadPreview = !!this.booking;
    if (!hadPreview) {
      this.loading = true;
    }
    try {
      const res = await this.bookings.show(this.data.bookingId);
      this.booking = res.data || this.booking;
      if (!this.booking) {
        this.snackbar.show(this.translate.instant('BOOK_DETAIL_NOT_FOUND'), 'error');
        this.dialogRef.close();
      }
    } catch (e: unknown) {
      if (!hadPreview) {
        this.snackbar.show(this.err(e), 'error');
        this.dialogRef.close();
      }
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      const page = await this.usersApi.list(200);
      this.users = page.data || [];
    } catch {
      this.users = [];
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
