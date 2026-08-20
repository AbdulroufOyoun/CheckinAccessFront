import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { SnackbarService } from '../services/snackbar.service';
import {
  RoomOccupancyStatus,
  RoomStatusItem,
  RoomStatusPayload,
  RoomStatusSchedule,
  RoomStatusService,
  RoomStatusSummary,
} from '../services/room-status.service';
import { RealtimeService } from '../services/realtime.service';

interface FloorGroup {
  floorId: number | null;
  floorLabel: string;
  rooms: RoomStatusItem[];
}

interface BuildingGroup {
  buildingId: number | null;
  buildingName: string;
  floors: FloorGroup[];
}

@Component({
  selector: 'app-room-status-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './room-status-page.html',
  styleUrl: './room-status-page.css',
})
export class RoomStatusPage implements OnInit, OnDestroy {
  private readonly api = inject(RoomStatusService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly destroy$ = new Subject<void>();

  isRTL = false;
  loading = false;
  loaded = false;

  date = '';
  time = '';
  buildingId: number | null = null;
  floorId: number | null = null;
  suiteId: number | null = null;
  search = '';
  statusFilter: RoomOccupancyStatus | 'all' = 'all';

  buildings: Array<{
    id: number;
    name: string;
    floors: Array<{
      id: number;
      number: string | number;
      suites: Array<{ id: number; number?: string; name?: string }>;
    }>;
  }> = [];
  payload: RoomStatusPayload | null = null;

  readonly skeletonKpis = [0, 1, 2, 3, 4];
  readonly skeletonFloors = [
    { id: 1, rooms: [0, 1, 2, 3, 4, 5, 6, 7] },
    { id: 2, rooms: [0, 1, 2, 3, 4, 5] },
  ];

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });

    const now = new Date();
    this.date = this.toDateInput(now);
    this.time = this.toTimeInput(now);

    void this.bootstrap();
    this.realtime.occupancyChanged.pipe(takeUntil(this.destroy$)).subscribe(() => {
      void this.load(true);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get floorsForBuilding(): Array<{
    id: number;
    number: string | number;
    suites: Array<{ id: number; number?: string; name?: string }>;
  }> {
    if (!this.buildingId) return [];
    return this.buildings.find((b) => b.id === this.buildingId)?.floors || [];
  }

  get suitesForFloor(): Array<{ id: number; number?: string; name?: string }> {
    if (!this.floorId) return [];
    return this.floorsForBuilding.find((f) => f.id === this.floorId)?.suites || [];
  }

  get summary(): RoomStatusSummary {
    return (
      this.payload?.summary || {
        total: 0,
        available: 0,
        occupied: 0,
        on_hold: 0,
        inactive: 0,
      }
    );
  }

  get filteredRooms(): RoomStatusItem[] {
    const rooms = this.payload?.rooms || [];
    const q = this.search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (this.statusFilter !== 'all' && r.status !== this.statusFilter) return false;
      if (!q) return true;
      return (
        String(r.number || '').toLowerCase().includes(q) ||
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.room_type?.name || '').toLowerCase().includes(q) ||
        String(r.building?.name || '').toLowerCase().includes(q) ||
        String(r.suite?.name || '').toLowerCase().includes(q) ||
        String(r.suite?.number || '').toLowerCase().includes(q) ||
        String(r.booking?.guest || '').toLowerCase().includes(q) ||
        String(r.schedule?.subject || '').toLowerCase().includes(q) ||
        String(r.schedule?.subject_ar || '').toLowerCase().includes(q)
      );
    });
  }

  get groups(): BuildingGroup[] {
    const map = new Map<string, BuildingGroup>();
    for (const room of this.filteredRooms) {
      const buildingId = room.building?.id ?? null;
      const buildingKey = String(buildingId ?? 'none');
      if (!map.has(buildingKey)) {
        map.set(buildingKey, {
          buildingId,
          buildingName: room.building?.name || this.translate.instant('ROOM_STATUS_UNKNOWN_BUILDING'),
          floors: [],
        });
      }
      const building = map.get(buildingKey)!;
      const floorId = room.floor?.id ?? null;
      let floor = building.floors.find((f) => f.floorId === floorId);
      if (!floor) {
        floor = {
          floorId,
          floorLabel: room.floor
            ? `${this.translate.instant('ROOM_STATUS_FLOOR')} ${room.floor.number}`
            : this.translate.instant('ROOM_STATUS_NO_FLOOR'),
          rooms: [],
        };
        building.floors.push(floor);
      }
      floor.rooms.push(room);
    }

    return [...map.values()].map((b) => ({
      ...b,
      floors: b.floors.sort((a, c) => String(a.floorLabel).localeCompare(String(c.floorLabel), undefined, { numeric: true })),
    }));
  }

  get filteredCount(): number {
    return this.filteredRooms.length;
  }

  async bootstrap(): Promise<void> {
    this.loading = true;
    try {
      this.buildings = await this.api.getFilterBuildings();
    } catch {
      this.buildings = [];
    }
    await this.load();
  }

  async load(silent = false): Promise<void> {
    if (!this.date || !this.time) return;
    if (!silent) {
      this.loading = true;
    }
    try {
      this.payload = await this.api.getStatus({
        date: this.date,
        time: this.time,
        building_id: this.buildingId,
        floor_id: this.floorId,
        suite_id: this.suiteId,
      });
      this.loaded = true;
    } catch (e: unknown) {
      if (silent) {
        return;
      }
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'),
        'error',
      );
    } finally {
      if (!silent) {
        this.loading = false;
      }
      this.cdr.detectChanges();
    }
  }

  onBuildingChange(): void {
    this.floorId = null;
    this.suiteId = null;
    void this.load();
  }

  onFloorChange(): void {
    this.suiteId = null;
    void this.load();
  }

  setStatusFilter(status: RoomOccupancyStatus | 'all'): void {
    this.statusFilter = this.statusFilter === status ? 'all' : status;
  }

  statusLabel(status: RoomOccupancyStatus): string {
    const map: Record<RoomOccupancyStatus, string> = {
      available: 'ROOM_STATUS_AVAILABLE',
      occupied: 'ROOM_STATUS_OCCUPIED',
      on_hold: 'ROOM_STATUS_ON_HOLD',
      inactive: 'ROOM_STATUS_INACTIVE',
    };
    return this.translate.instant(map[status]);
  }

  scheduleLabel(schedule: RoomStatusSchedule): string {
    const subject = this.isRTL
      ? (schedule.subject_ar || schedule.subject || '')
      : (schedule.subject || schedule.subject_ar || '');
    const section = schedule.section_number
      ? this.translate.instant('SCHED_SECTION', { n: schedule.section_number })
      : '';
    return [subject, section].filter(Boolean).join(' · ') || this.translate.instant('ROOM_STATUS_CLASS');
  }

  trackBuilding(_: number, g: BuildingGroup): string {
    return String(g.buildingId ?? 'none');
  }

  trackFloor(_: number, f: FloorGroup): string {
    return String(f.floorId ?? 'none');
  }

  trackRoom(_: number, r: RoomStatusItem): number {
    return r.id;
  }

  openRoom(room: RoomStatusItem): void {
    void this.router.navigate(['/RoomStatus', room.id], {
      queryParams: { date: this.date, time: this.time },
    });
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
