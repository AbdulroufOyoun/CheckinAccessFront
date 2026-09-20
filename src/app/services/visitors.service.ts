import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import { TenantUser, UserFormPayload, UsersPage } from './users.service';

export interface VisitorEventViewMeta {
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  view_count?: number;
}

export interface VisitorEventRow {
  id: number;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  rooms?: Array<{ id: number; number?: string | null; name?: string | null }>;
  viewed?: VisitorEventViewMeta;
}

export interface VisitorEventsPayload {
  assigned_events: VisitorEventRow[];
  entered_events: VisitorEventRow[];
}

@Injectable({ providedIn: 'root' })
export class VisitorsService {
  private readonly api = inject(ApiService);

  list(perPage = 100): Promise<UsersPage> {
    return this.api.get(`${Apiendpointd.visitors}?per_page=${perPage}`).then((raw) => this.unwrapPage(raw));
  }

  searchByName(userName: string, perPage = 100): Promise<UsersPage> {
    const qs = new URLSearchParams({ user_name: userName, per_page: String(perPage) });
    return this.api.get(`${Apiendpointd.visitorsSearchName}?${qs}`).then((raw) => this.unwrapPage(raw));
  }

  show(id: number): Promise<ApiResponse<TenantUser>> {
    return this.api.get<ApiResponse<TenantUser>>(Apiendpointd.visitorById(id));
  }

  events(id: number): Promise<ApiResponse<VisitorEventsPayload>> {
    return this.api.get<ApiResponse<VisitorEventsPayload>>(Apiendpointd.visitorEvents(id));
  }

  create(body: UserFormPayload): Promise<ApiResponse<TenantUser>> {
    return this.api.post(Apiendpointd.visitors, body) as Promise<ApiResponse<TenantUser>>;
  }

  update(id: number, body: Partial<UserFormPayload>): Promise<ApiResponse<TenantUser>> {
    return this.api.post(Apiendpointd.visitorById(id), body) as Promise<ApiResponse<TenantUser>>;
  }

  remove(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.visitorById(id)) as Promise<ApiResponse<unknown>>;
  }

  private unwrapPage(raw: unknown): UsersPage {
    const res = (raw || {}) as UsersPage & { data?: TenantUser[] | { data?: TenantUser[]; total?: number } };
    if (Array.isArray(res.data)) {
      return { ...res, data: res.data, total: res.total ?? res.data.length };
    }
    const nested = (res.data && typeof res.data === 'object' ? res.data : {}) as {
      data?: TenantUser[];
      total?: number;
    };
    const rows = Array.isArray(nested.data) ? nested.data : [];
    return { ...res, data: rows, total: nested.total ?? res.total ?? rows.length };
  }
}
