import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export type EventStatus = 'draft' | 'active' | 'cancelled';
export type EventAudienceMode = 'all_students' | 'selected_students';

export interface EventPeriodTime {
  id?: number;
  start_time: string;
  end_time: string;
}

export interface EventRoomOption {
  id: number;
  number?: string | null;
  name?: string | null;
  capacity?: number | null;
  available: boolean;
  conflict_reason?: string | null;
  building?: { id: number; name: string } | null;
  room_type?: { id: number; name: string } | null;
}

export interface EventUserRef {
  id: number;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
}

export interface EduEvent {
  id: number;
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  time_scheduled: boolean;
  audience_mode: EventAudienceMode;
  weekends_included: boolean;
  gregorian_holidays_included: boolean;
  islamic_holidays_included: boolean;
  status: EventStatus;
  created_by?: number | null;
  period_times: EventPeriodTime[];
  excluded_weekdays: number[];
  rooms: Array<{ id: number; number?: string | null; name?: string | null; capacity?: number | null }>;
  attendees: EventUserRef[];
  supervisors: EventUserRef[];
  created_at?: string;
  updated_at?: string;
}

export interface EventAvailabilityResult {
  available: boolean;
  accessible_days: number;
  blocked_dates: Array<{ date: string; reasons: string[] }>;
  overlap_errors: string[];
  rooms: EventRoomOption[];
}

export interface EventPayload {
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  time_scheduled?: boolean;
  period_times?: EventPeriodTime[];
  excluded_weekdays?: number[];
  weekends_included?: boolean;
  gregorian_holidays_included?: boolean;
  islamic_holidays_included?: boolean;
  audience_mode?: EventAudienceMode;
  room_ids?: number[];
  attendee_user_ids?: number[];
  supervisor_user_ids?: number[];
  status?: EventStatus;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly api = inject(ApiService);

  list(params: { status?: string; from?: string; to?: string } = {}): Promise<ApiResponse<EduEvent[]>> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.api.get(`${Apiendpointd.educationEvents}${suffix}`);
  }

  get(id: number): Promise<ApiResponse<EduEvent>> {
    return this.api.get(Apiendpointd.educationEventById(id));
  }

  create(body: EventPayload): Promise<ApiResponse<EduEvent>> {
    return this.api.post(Apiendpointd.educationEvents, this.normalizeBody(body));
  }

  update(id: number, body: Partial<EventPayload>): Promise<ApiResponse<EduEvent>> {
    return this.api.put(Apiendpointd.educationEventById(id), this.normalizeBody(body));
  }

  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.educationEventById(id));
  }

  activate(id: number): Promise<ApiResponse<EduEvent>> {
    return this.api.post(Apiendpointd.educationEventActivate(id));
  }

  cancel(id: number): Promise<ApiResponse<EduEvent>> {
    return this.api.post(Apiendpointd.educationEventCancel(id));
  }

  rooms(params: {
    start_date: string;
    end_date: string;
    time_scheduled?: boolean;
    period_times?: EventPeriodTime[];
    exclude_event_id?: number;
  }): Promise<ApiResponse<EventRoomOption[]>> {
    return this.api.post(Apiendpointd.educationEventRooms, {
      start_date: params.start_date,
      end_date: params.end_date,
      time_scheduled: !!params.time_scheduled,
      period_times: params.period_times?.length ? this.normalizePeriodTimes(params.period_times) : [],
      exclude_event_id: params.exclude_event_id,
    });
  }

  validateAvailability(body: EventPayload & { exclude_event_id?: number }): Promise<ApiResponse<EventAvailabilityResult>> {
    return this.api.post(Apiendpointd.educationEventValidate, this.normalizeBody(body));
  }

  private normalizeBody(body: Partial<EventPayload & { exclude_event_id?: number }>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...body };
    if (body.period_times) {
      out['period_times'] = this.normalizePeriodTimes(body.period_times);
    }
    return out;
  }

  private normalizePeriodTimes(times: EventPeriodTime[]): EventPeriodTime[] {
    return times.map((t) => ({
      start_time: this.toHms(t.start_time),
      end_time: this.toHms(t.end_time),
    }));
  }

  private toHms(value: string): string {
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
    return value;
  }
}
