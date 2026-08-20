import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export type DurationKind = 'time' | 'days' | 'date_range';
export type DurationScope = 'property' | 'education' | 'both';

export interface DurationPreset {
  id: number;
  name: string;
  kind: DurationKind;
  start_time?: string | null;
  end_time?: string | null;
  days?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  scope: DurationScope;
  active: boolean;
  sort_order?: number;
}

export interface DurationListParams {
  scope?: DurationScope;
  kind?: DurationKind | 'stay';
  activeOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DurationsService {
  private readonly api = inject(ApiService);

  list(params: DurationListParams = {}): Promise<ApiResponse<DurationPreset[]>> {
    const qs = new URLSearchParams();
    if (params.scope) qs.set('scope', params.scope);
    if (params.kind) qs.set('kind', params.kind);
    if (params.activeOnly) qs.set('active_only', '1');
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.api.get(`${Apiendpointd.durations}${suffix}`);
  }

  create(body: {
    name: string;
    kind: DurationKind;
    start_time?: string | null;
    end_time?: string | null;
    days?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    scope?: DurationScope;
    sort_order?: number;
  }): Promise<ApiResponse<DurationPreset>> {
    return this.api.post(Apiendpointd.durations, body);
  }

  update(
    id: number,
    body: Partial<{
      name: string;
      kind: DurationKind;
      start_time: string | null;
      end_time: string | null;
      days: number | null;
      start_date: string | null;
      end_date: string | null;
      scope: DurationScope;
      active: boolean;
      sort_order: number;
    }>,
  ): Promise<ApiResponse<DurationPreset>> {
    return this.api.put(Apiendpointd.durationById(id), body);
  }

  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.durationById(id));
  }

  activate(id: number): Promise<ApiResponse<DurationPreset>> {
    return this.api.post(Apiendpointd.durationActivate(id));
  }

  inactivate(id: number): Promise<ApiResponse<DurationPreset>> {
    return this.api.post(Apiendpointd.durationInactivate(id));
  }
}
