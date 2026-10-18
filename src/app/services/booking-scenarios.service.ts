import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export type BookingScenarioRoomScope = 'all' | 'selected';

export interface BookingScenario {
  id: number;
  name: string;
  name_ar?: string | null;
  room_scope: BookingScenarioRoomScope;
  room_ids?: number[] | null;
  active: boolean;
  sort_order?: number;
}

export interface BookingScenarioRoomOption {
  id: number;
  number: string;
  name?: string | null;
  building?: string | null;
  floor?: string | number | null;
  suite?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BookingScenariosService {
  private readonly api = inject(ApiService);

  list(activeOnly = false): Promise<ApiResponse<BookingScenario[]>> {
    const qs = activeOnly ? '?active_only=1' : '';
    return this.api.get(`${Apiendpointd.bookingScenarios}${qs}`);
  }

  roomOptions(): Promise<ApiResponse<BookingScenarioRoomOption[]>> {
    return this.api.get(Apiendpointd.bookingScenarioRoomOptions());
  }

  create(body: {
    name: string;
    name_ar?: string | null;
    room_scope: BookingScenarioRoomScope;
    room_ids?: number[];
    sort_order?: number;
  }): Promise<ApiResponse<BookingScenario>> {
    return this.api.post(Apiendpointd.bookingScenarios, body);
  }

  update(
    id: number,
    body: Partial<{
      name: string;
      name_ar: string | null;
      room_scope: BookingScenarioRoomScope;
      room_ids: number[];
      active: boolean;
      sort_order: number;
    }>,
  ): Promise<ApiResponse<BookingScenario>> {
    return this.api.put(Apiendpointd.bookingScenarioById(id), body);
  }

  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.bookingScenarioById(id));
  }

  activate(id: number): Promise<ApiResponse<BookingScenario>> {
    return this.api.post(Apiendpointd.bookingScenarioActivate(id));
  }

  inactivate(id: number): Promise<ApiResponse<BookingScenario>> {
    return this.api.post(Apiendpointd.bookingScenarioInactivate(id));
  }
}
