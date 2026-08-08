import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export interface DoorUnlockRecord {
  id: number;
  room_id?: number | null;
  room_number?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  created_at?: string | null;
}

export interface DoorUnlockPage {
  data: DoorUnlockRecord[];
  total?: number;
  current_page?: number;
  last_page?: number;
  per_page?: number;
}

@Injectable({ providedIn: 'root' })
export class DoorUnlockService {
  private readonly api = inject(ApiService);

  async list(params?: {
    user_id?: number;
    room_id?: number;
    start?: string;
    end?: string;
    per_page?: number;
  }): Promise<DoorUnlockPage> {
    const qs = new URLSearchParams();
    if (params?.user_id) qs.set('user_id', String(params.user_id));
    if (params?.room_id) qs.set('room_id', String(params.room_id));
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    qs.set('per_page', String(params?.per_page ?? 50));
    const suffix = qs.toString() ? `?${qs}` : '';

    const raw = (await this.api.get(`${Apiendpointd.doorUnlockHistory}${suffix}`)) as ApiResponse<
      DoorUnlockRecord[] | DoorUnlockPage
    >;

    if (Array.isArray(raw.data)) {
      return { data: raw.data, total: raw.data.length };
    }

    const page = (raw.data || {}) as DoorUnlockPage;
    return {
      data: page.data || [],
      total: page.total,
      current_page: page.current_page,
      last_page: page.last_page,
      per_page: page.per_page,
    };
  }
}
