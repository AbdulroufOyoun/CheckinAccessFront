import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import { PropertyTreeCache } from './property-tree-cache.service';

export type RoomOccupancyStatus = 'available' | 'occupied' | 'on_hold' | 'inactive';

export interface RoomStatusBooking {
  id: number;
  check_in_date: string;
  check_out_date: string;
  time_scheduled: boolean;
  on_hold?: boolean;
  guest?: string | null;
}

export interface RoomStatusSchedule {
  section_time_id?: number;
  section_id?: number;
  subject?: string | null;
  subject_ar?: string | null;
  section_number?: string | null;
  doctor?: string | null;
  start?: string | null;
  end?: string | null;
  room_name?: string | null;
  is_practical?: boolean;
}

export interface RoomClassSlot extends RoomStatusSchedule {
  day_id: number;
  day_name?: string | null;
  day_sort?: number;
  is_today?: boolean;
  covers_now?: boolean;
}

export interface RoomClassesPayload {
  date: string;
  room_id: number;
  classes: RoomClassSlot[];
}

export interface RoomStatusItem {
  id: number;
  number: string;
  name?: string | null;
  capacity?: number;
  used_capacity?: number;
  remaining_capacity?: number;
  active: boolean;
  status: RoomOccupancyStatus;
  room_type?: { id: number; name: string } | null;
  building?: { id: number; name?: string | null } | null;
  floor?: { id: number; number: string | number } | null;
  suite?: { id: number; number?: string | null; name?: string | null } | null;
  booking?: RoomStatusBooking | null;
  schedule?: RoomStatusSchedule | null;
  blocked_by?: 'booking' | 'schedule' | null;
}

export interface RoomStatusSummary {
  total: number;
  available: number;
  occupied: number;
  on_hold?: number;
  inactive: number;
}

export interface RoomStatusPayload {
  date: string;
  time: string;
  summary: RoomStatusSummary;
  rooms: RoomStatusItem[];
}

export interface RoomStatusQuery {
  date: string;
  time: string;
  compound_id?: number | null;
  building_id?: number | null;
  floor_id?: number | null;
  suite_id?: number | null;
}

export interface RoomPeriodAvailabilityQuery {
  check_in_date: string;
  check_out_date: string;
  time_scheduled?: boolean;
  period_times?: Array<{ start_time: string; end_time: string }>;
  compound_id?: number | null;
  building_id?: number | null;
  floor_id?: number | null;
  requested_occupants?: number;
}

export interface RoomPeriodAvailabilityPayload {
  check_in_date: string;
  check_out_date: string;
  time_scheduled: boolean;
  summary: RoomStatusSummary;
  rooms: RoomStatusItem[];
}

@Injectable({ providedIn: 'root' })
export class RoomStatusService {
  private readonly api = inject(ApiService);
  private readonly treeCache = inject(PropertyTreeCache);

  async getStatus(query: RoomStatusQuery): Promise<RoomStatusPayload> {
    const params = new URLSearchParams();
    params.set('date', query.date);
    params.set('time', query.time);
    if (query.compound_id) params.set('compound_id', String(query.compound_id));
    if (query.building_id) params.set('building_id', String(query.building_id));
    if (query.floor_id) params.set('floor_id', String(query.floor_id));
    if (query.suite_id) params.set('suite_id', String(query.suite_id));

    const res = await this.api.get<ApiResponse<RoomStatusPayload>>(
      `${Apiendpointd.roomsStatus}?${params.toString()}`,
    );
    return res.data;
  }

  async getAvailabilityForPeriod(
    body: RoomPeriodAvailabilityQuery,
  ): Promise<RoomPeriodAvailabilityPayload> {
    const res = await this.api.post<ApiResponse<RoomPeriodAvailabilityPayload>>(
      Apiendpointd.roomsAvailability,
      body,
    );
    return res.data;
  }

  async getFilterBuildings(): Promise<
    Array<{
      id: number;
      name: string;
      floors: Array<{
        id: number;
        number: string | number;
        suites: Array<{ id: number; number?: string; name?: string }>;
      }>;
    }>
  > {
    const bd = await this.treeCache.getBuildingData<{
      building?: Array<{
        id: number;
        name: string;
        floors?: Array<{
          id: number;
          number: string | number;
          suites?: Array<{ id: number; number?: string; name?: string }>;
        }>;
      }>;
    }>();
    const buildings = bd?.building || [];
    return buildings.map((b) => ({
      id: b.id,
      name: b.name,
      floors: (b.floors || []).map((f) => ({
        id: f.id,
        number: f.number,
        suites: f.suites || [],
      })),
    }));
  }

  getRoomDetail(id: number): Promise<ApiResponse<RoomDetail>> {
    const qs = new URLSearchParams({ id: String(id), model: 'room' });
    return this.api.get(`${Apiendpointd.dataById}?${qs}`);
  }

  async getRoomClasses(
    id: number,
    query?: { date?: string; time?: string },
  ): Promise<RoomClassesPayload> {
    const params = new URLSearchParams();
    if (query?.date) params.set('date', query.date);
    if (query?.time) params.set('time', query.time);
    const qs = params.toString();
    const res = await this.api.get<ApiResponse<RoomClassesPayload>>(
      qs ? `${Apiendpointd.roomClasses(id)}?${qs}` : Apiendpointd.roomClasses(id),
    );
    return res.data ?? { date: query?.date || '', room_id: id, classes: [] };
  }
}

export interface RoomDetail {
  id: number;
  number?: string;
  name?: string | null;
  capacity?: number | null;
  active?: boolean | number;
  room_type?: { id: number; name?: string } | null;
  roomType?: { id: number; name?: string } | null;
  suite?: { id: number; number?: string | null; name?: string | null } | null;
  floor?: {
    id: number;
    number?: string | number;
    building?: { id: number; name?: string | null; number?: string | null } | null;
  } | null;
  locks?: Array<{
    id: number;
    lockName?: string | null;
    lockAlias?: string | null;
    lockMac?: string | null;
  }>;
}
