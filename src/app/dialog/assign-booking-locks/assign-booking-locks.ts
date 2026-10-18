import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Booking,
  BookingUnit,
  BookingsService,
} from '../../services/bookings.service';
import {
  LockableType,
  PropertyApiService,
  PropLock,
  lockLinkTotal,
} from '../../property/services/property-api.service';

export type OtherLockGroupId =
  | 'building'
  | 'floor'
  | 'suite'
  | 'room'
  | 'facility'
  | 'gate'
  | 'parking'
  | 'elevator'
  | 'unlinked';

export interface OtherLockGroupView {
  id: OtherLockGroupId;
  labelKey: string;
  locks: PropLock[];
}
import { SnackbarService } from '../../services/snackbar.service';
import { TenantDateTimeService } from '../../services/tenant-date-time.service';

export interface AssignBookingLocksData {
  bookingId: number;
  guestName: string;
  unitLabel?: string;
  building?: string;
  checkIn?: string;
  checkOut?: string;
}

@Component({
  selector: 'app-assign-booking-locks',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TranslateModule],
  templateUrl: './assign-booking-locks.html',
  styleUrl: './assign-booking-locks.css',
})
export class AssignBookingLocksDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AssignBookingLocksDialog, boolean>);
  private readonly data = inject<AssignBookingLocksData>(MAT_DIALOG_DATA);
  private readonly bookings = inject(BookingsService);
  private readonly property = inject(PropertyApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly tenantDateTime = inject(TenantDateTimeService);

  loading = true;
  saving = false;
  isRTL = false;
  search = '';
  locks: PropLock[] = [];
  selected = new Set<number>();
  assigned = new Set<number>();
  unitLockIds = new Set<number>();

  readonly skelRows = [0, 1, 2, 3];

  /** Display order follows property hierarchy (compound tree). */
  private readonly otherGroupOrder: OtherLockGroupId[] = [
    'building',
    'floor',
    'suite',
    'room',
    'facility',
    'gate',
    'parking',
    'elevator',
    'unlinked',
  ];

  private readonly groupLabelKeys: Record<OtherLockGroupId, string> = {
    building: 'BOOK_LOCKS_GROUP_BUILDINGS',
    floor: 'BOOK_LOCKS_GROUP_FLOORS',
    suite: 'BOOK_LOCKS_GROUP_SUITES',
    room: 'BOOK_LOCKS_GROUP_ROOMS',
    facility: 'BOOK_LOCKS_GROUP_FACILITIES',
    gate: 'BOOK_LOCKS_GROUP_GATES',
    parking: 'BOOK_LOCKS_GROUP_PARKINGS',
    elevator: 'BOOK_LOCKS_GROUP_ELEVATORS',
    unlinked: 'BOOK_LOCKS_GROUP_UNLINKED',
  };

  private summaryUnitText = '';
  private summaryDatesText = '';

  get bookingId(): number {
    return this.data.bookingId;
  }

  get guestName(): string {
    return this.data.guestName;
  }

  get guestInitials(): string {
    const cleaned = (this.guestName || '').trim();
    if (!cleaned || cleaned.startsWith('#')) return '?';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  get summaryUnit(): string {
    return this.summaryUnitText || '—';
  }

  get summaryDates(): string {
    return this.summaryDatesText;
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  get dirty(): boolean {
    if (this.selected.size !== this.assigned.size) return true;
    for (const id of this.selected) {
      if (!this.assigned.has(id)) return true;
    }
    return false;
  }

  get visibleUnitLocks(): PropLock[] {
    return this.filterLocks(this.locks.filter((l) => this.unitLockIds.has(l.id)));
  }

  get visibleOtherGroups(): OtherLockGroupView[] {
    const others = this.filterLocks(this.locks.filter((l) => !this.unitLockIds.has(l.id)));
    const buckets = new Map<OtherLockGroupId, PropLock[]>();
    for (const id of this.otherGroupOrder) {
      buckets.set(id, []);
    }
    for (const lock of others) {
      const group = this.primaryOtherGroup(lock);
      buckets.get(group)?.push(lock);
    }
    return this.otherGroupOrder
      .map((id) => ({
        id,
        labelKey: this.groupLabelKeys[id],
        locks: buckets.get(id) ?? [],
      }))
      .filter((g) => g.locks.length > 0);
  }

  get hasVisibleOtherLocks(): boolean {
    return this.visibleOtherGroups.length > 0;
  }

  get hasVisibleLocks(): boolean {
    return this.visibleUnitLocks.length > 0 || this.hasVisibleOtherLocks;
  }

  private primaryOtherGroup(lock: PropLock): OtherLockGroupId {
    if ((lock.rooms_count ?? 0) > 0) return 'room';
    if ((lock.suites_count ?? 0) > 0) return 'suite';
    if ((lock.floors_count ?? 0) > 0) return 'floor';
    if ((lock.buildings_count ?? 0) > 0) return 'building';
    if ((lock.facilities_count ?? 0) > 0) return 'facility';
    if ((lock.gates_count ?? 0) > 0) return 'gate';
    if ((lock.parkings_count ?? 0) > 0) return 'parking';
    if ((lock.elevators_count ?? 0) > 0) return 'elevator';
    if (lockLinkTotal(lock) === 0) return 'unlinked';
    return 'unlinked';
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.markForCheck();
    });
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      const [allLocks, bookingRes] = await Promise.all([
        this.property.listLocks(),
        this.bookings.show(this.bookingId),
      ]);
      this.locks = allLocks || [];
      const booking = bookingRes.data;
      if (booking) {
        this.applyBookingSummary(booking);
        this.unitLockIds = await this.collectUnitLockIds(booking);
      } else {
        this.applyFallbackSummary();
      }
      const current = booking?.locks || [];
      this.assigned = new Set(current.map((l) => l.id));
      this.selected = new Set(this.assigned);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
      this.applyFallbackSummary();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private applyFallbackSummary(): void {
    const unit = (this.data.unitLabel || '').trim();
    const building = (this.data.building || '').trim();
    this.summaryUnitText = building && building !== '—' ? `${unit} · ${building}` : unit || '—';
    if (this.data.checkIn && this.data.checkOut) {
      this.summaryDatesText = `${this.fmtDate(this.data.checkIn)} → ${this.fmtDate(this.data.checkOut)}`;
    }
  }

  private applyBookingSummary(booking: Booking): void {
    const units = booking.booking_period_units || booking.bookingPeriodUnits || [];
    const unit = units[0];
    const periods = booking.booking_periods || booking.bookingPeriods || [];
    const period = periods[0];

    const unitLabel = this.data.unitLabel?.trim() || this.unitLabel(unit);
    const building = this.data.building?.trim() || this.buildingLabel(unit);
    this.summaryUnitText =
      building && building !== '—' ? `${unitLabel} · ${building}` : unitLabel || '—';

    const checkIn = this.data.checkIn || period?.check_in_date;
    const checkOut = this.data.checkOut || period?.check_out_date;
    if (checkIn && checkOut) {
      this.summaryDatesText = `${this.fmtDate(checkIn)} → ${this.fmtDate(checkOut)}`;
    }
  }

  private async collectUnitLockIds(booking: Booking): Promise<Set<number>> {
    const units = booking.booking_period_units || booking.bookingPeriodUnits || [];
    const ids = new Set<number>();
    const fetches: Array<{ type: LockableType; id: number }> = [];

    for (const u of units) {
      if (u.room_id) fetches.push({ type: 'room', id: u.room_id });
      else if (u.room?.id) fetches.push({ type: 'room', id: u.room.id });
      if (u.building_id) fetches.push({ type: 'building', id: u.building_id });
      else if (u.building?.id) fetches.push({ type: 'building', id: u.building.id });
      if (u.facility_id) fetches.push({ type: 'facility', id: u.facility_id });
      else if (u.facility?.id) fetches.push({ type: 'facility', id: u.facility.id });
      if (u.gate_id) fetches.push({ type: 'gate', id: u.gate_id });
      else if (u.gate?.id) fetches.push({ type: 'gate', id: u.gate.id });
      if (u.parking_id) fetches.push({ type: 'parking', id: u.parking_id });
      else if (u.parking?.id) fetches.push({ type: 'parking', id: u.parking.id });
      if (u.floor_id) fetches.push({ type: 'floor', id: u.floor_id });
      if (u.suite_id) fetches.push({ type: 'suite', id: u.suite_id });
    }

    const seen = new Set<string>();
    const unique = fetches.filter(({ type, id }) => {
      const key = `${type}:${id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await Promise.all(
      unique.map(async ({ type, id }) => {
        try {
          const linked = await this.property.getPropertyLocks(type, id);
          for (const lock of linked) {
            ids.add(lock.id);
          }
        } catch {
          /* unit may have no locks endpoint data */
        }
      }),
    );

    return ids;
  }

  private filterLocks(list: PropLock[]): PropLock[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((lock) => {
      const hay = [
        lock.lockAlias,
        lock.lockName,
        lock.lockMac,
        lock.lockId != null ? String(lock.lockId) : '',
        `#${lock.id}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  toggle(id: number): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  isChecked(id: number): boolean {
    return this.selected.has(id);
  }

  wasAssigned(id: number): boolean {
    return this.assigned.has(id);
  }

  lockTitle(lock: PropLock): string {
    return lock.lockAlias || lock.lockName || `#${lock.id}`;
  }

  lockSub(lock: PropLock): string {
    return lock.lockId != null ? String(lock.lockId) : lock.lockMac || '';
  }

  selectAllUnit(): void {
    for (const lock of this.locks) {
      if (this.unitLockIds.has(lock.id)) {
        this.selected.add(lock.id);
      }
    }
  }

  clearSelection(): void {
    this.selected.clear();
  }

  async save(): Promise<void> {
    this.saving = true;
    try {
      const next = Array.from(this.selected);
      const toAdd = next.filter((id) => !this.assigned.has(id));
      const toRemove = Array.from(this.assigned).filter((id) => !this.selected.has(id));

      if (toAdd.length) {
        await this.bookings.assignLocks(this.bookingId, toAdd);
      }
      if (toRemove.length) {
        await this.bookings.removeLocks(this.bookingId, toRemove);
      }

      this.snackbar.show(this.translate.instant('BOOK_LOCKS_SAVED'), 'success');
      this.dialogRef.close(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  close(): void {
    this.dialogRef.close(false);
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

  private fmtDate(value?: string | null): string {
    return this.tenantDateTime.formatDate(value);
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    if (typeof m === 'string' && m) return m;
    if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
    return this.translate.instant('BOOK_LOCKS_FAILED');
  }
}
