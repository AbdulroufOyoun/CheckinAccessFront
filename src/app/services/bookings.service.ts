import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import { PropertyTreeCache } from './property-tree-cache.service';

export interface BookingPeriodTime {
  id?: number;
  start_time: string;
  end_time: string;
}

export interface BookingPeriod {
  id?: number;
  check_in_date: string;
  check_out_date: string;
  time_scheduled?: boolean;
  weekends_included?: boolean;
  gregorian_holidays_included?: boolean;
  islamic_holidays_included?: boolean;
  cancelled?: boolean;
  on_hold?: boolean;
  period_times?: BookingPeriodTime[];
  periodTimes?: BookingPeriodTime[];
}

export interface BookingUnit {
  id?: number;
  room_id?: number | null;
  building_id?: number | null;
  facility_id?: number | null;
  floor_id?: number | null;
  suite_id?: number | null;
  room?: { id: number; number?: string; name?: string; floor?: { building?: { name?: string } } } | null;
  building?: { id: number; name?: string } | null;
  facility?: { id: number; name?: string } | null;
}

export interface Booking {
  id: number;
  user_id: number;
  cancelled?: boolean;
  on_hold?: boolean;
  created_at?: string;
  user?: { id: number; name?: string; email?: string; mobile?: string } | null;
  booking_periods?: BookingPeriod[];
  bookingPeriods?: BookingPeriod[];
  booking_period_units?: BookingUnit[];
  bookingPeriodUnits?: BookingUnit[];
  locks?: Array<{ id: number; lockName?: string; lockAlias?: string; lockMac?: string }>;
}

export interface BookingsPage {
  success?: boolean;
  message?: string;
  data: Booking[];
  total?: number;
  current_page?: number;
  last_page?: number;
  per_page?: number;
}

export interface CreateBookingPeriodPayload {
  check_in_date: string;
  check_out_date: string;
  time_scheduled: boolean;
  weekends_included?: boolean;
  gregorian_holidays_included?: boolean;
  islamic_holidays_included?: boolean;
  excluded_weekdays?: number[];
  units: Array<{
    unit_type: string;
    unit_id: number;
    sequential?: boolean;
    sub_units_included?: boolean;
  }>;
  period_times?: Array<{ start_time: string; end_time: string }>;
}

export interface CreateBookingPayload {
  bookings: Array<{
    user_id: number;
    booking_periods: CreateBookingPeriodPayload[];
  }>;
}

export interface AvailabilityResult {
  available: boolean;
  overlap_errors: string[];
  blocked_dates: Array<{ date: string; reasons: string[] }>;
  accessible_days?: number;
}

export interface PropertyRoomOption {
  id: number;
  label: string;
  number?: string;
  name?: string;
  buildingName?: string;
}

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly api = inject(ApiService);
  private readonly treeCache = inject(PropertyTreeCache);

  list(params?: { status?: string; per_page?: number }): Promise<BookingsPage> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    qs.set('per_page', String(params?.per_page ?? 100));
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.api.get(`${Apiendpointd.bookings}${suffix}`).then((raw: unknown) => {
      const res = raw as {
        success?: boolean;
        message?: string;
        data?: Booking[] | { data?: Booking[]; total?: number; current_page?: number; last_page?: number; per_page?: number };
        total?: number;
      };

      if (Array.isArray(res.data)) {
        return {
          success: res.success,
          message: res.message,
          data: res.data,
          total: res.total,
        };
      }

      const page = res.data || {};
      return {
        success: res.success,
        message: res.message,
        data: page.data || [],
        total: page.total,
        current_page: page.current_page,
        last_page: page.last_page,
        per_page: page.per_page,
      };
    });
  }

  show(id: number): Promise<ApiResponse<Booking>> {
    return this.api.get(Apiendpointd.bookingById(id));
  }

  create(body: CreateBookingPayload): Promise<ApiResponse<unknown>> {
    return this.api.post(Apiendpointd.bookings, body);
  }

  validateAvailability(body: Record<string, unknown>): Promise<ApiResponse<AvailabilityResult>> {
    return this.api.post(Apiendpointd.bookingsValidate, body);
  }

  cancel(id: number): Promise<ApiResponse<unknown>> {
    return this.api.post(Apiendpointd.bookingCancel(id));
  }

  hold(id: number): Promise<ApiResponse<unknown>> {
    return this.api.post(Apiendpointd.bookingHold(id));
  }

  resume(id: number): Promise<ApiResponse<unknown>> {
    return this.api.post(Apiendpointd.bookingResume(id));
  }

  remove(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.bookingById(id));
  }

  assignLocks(id: number, lockIds: number[]): Promise<ApiResponse<Booking>> {
    return this.api.post(Apiendpointd.bookingAssignLocks(id), { lock_ids: lockIds });
  }

  removeLocks(id: number, lockIds: number[]): Promise<ApiResponse<Booking>> {
    return this.api.post(Apiendpointd.bookingRemoveLocks(id), { lock_ids: lockIds });
  }

  listByUnit(unitType: string, unitId: number, perPage = 50): Promise<BookingsPage> {
    const qs = new URLSearchParams({
      unit_type: unitType,
      unit_id: String(unitId),
      per_page: String(perPage),
    });
    return this.api.get(`${Apiendpointd.bookingsByUnit}?${qs}`).then((raw: unknown) => {
      const res = raw as {
        success?: boolean;
        message?: string;
        data?: Booking[] | { data?: Booking[]; total?: number; current_page?: number; last_page?: number; per_page?: number };
        total?: number;
      };

      if (Array.isArray(res.data)) {
        return {
          success: res.success,
          message: res.message,
          data: res.data,
          total: res.total ?? res.data.length,
        };
      }

      const page = res.data || {};
      return {
        success: res.success,
        message: res.message,
        data: page.data || [],
        total: page.total,
        current_page: page.current_page,
        last_page: page.last_page,
        per_page: page.per_page,
      };
    });
  }

  async listRoomOptions(): Promise<PropertyRoomOption[]> {
    const bd = await this.treeCache.getBuildingData<{
      building?: Array<{
        name?: string;
        floors?: Array<{
          rooms?: Array<{ id: number; number?: string; name?: string }>;
          suites?: Array<{ rooms?: Array<{ id: number; number?: string; name?: string }> }>;
        }>;
      }>;
      rooms?: Array<{ id: number; number?: string; name?: string }>;
    }>();

    const options: PropertyRoomOption[] = [];
    const seen = new Set<number>();

    const push = (room: { id: number; number?: string; name?: string }, buildingName?: string) => {
      if (!room?.id || seen.has(room.id)) return;
      seen.add(room.id);
      const num = room.number || room.name || `#${room.id}`;
      options.push({
        id: room.id,
        number: room.number,
        name: room.name,
        buildingName,
        label: buildingName ? `${num} · ${buildingName}` : String(num),
      });
    };

    for (const building of bd?.building || []) {
      for (const floor of building.floors || []) {
        for (const room of floor.rooms || []) push(room, building.name);
        for (const suite of floor.suites || []) {
          for (const room of suite.rooms || []) push(room, building.name);
        }
      }
    }

    for (const room of bd?.rooms || []) push(room);

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }
}
