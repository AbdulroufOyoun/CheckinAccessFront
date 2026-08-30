import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export interface TenantUser {
  id: number;
  name: string;
  email: string;
  mobile: string;
  nationality?: string | null;
  title?: string | null;
  active?: boolean | number;
  is_platform_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UsersPage {
  data: TenantUser[];
  total?: number;
  current_page?: number;
  last_page?: number;
  per_page?: number;
  success?: boolean;
  message?: string;
}

export interface PaginatedPayload<T> {
  data?: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface UserFormPayload {
  name: string;
  email: string;
  mobile: string;
  nationality?: string | null;
  title?: string | null;
  password?: string | null;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  /** Deduplicate concurrent GET /users-management/:id calls. */
  private readonly showInflight = new Map<number, Promise<ApiResponse<TenantUser>>>();
  private readonly showCache = new Map<number, { at: number; data: ApiResponse<TenantUser> }>();
  private readonly showTtlMs = 30_000;

  list(perPage = 100): Promise<UsersPage> {
    return this.api.get(`${Apiendpointd.users}?per_page=${perPage}`).then((raw) => this.unwrapPage(raw));
  }

  searchByName(userName: string, perPage = 100): Promise<UsersPage> {
    const qs = new URLSearchParams({
      user_name: userName,
      per_page: String(perPage),
    });
    return this.api.get(`${Apiendpointd.usersSearchName}?${qs}`).then((raw) => this.unwrapPage(raw));
  }

  searchBy(by: string, value: string, perPage = 100): Promise<UsersPage> {
    const qs = new URLSearchParams({
      by,
      value,
      per_page: String(perPage),
    });
    return this.api.get(`${Apiendpointd.usersSearch}?${qs}`).then((raw) => this.unwrapPage(raw));
  }

  show(id: number, options?: { force?: boolean }): Promise<ApiResponse<TenantUser>> {
    const force = options?.force === true;
    if (!force) {
      const cached = this.showCache.get(id);
      if (cached && Date.now() - cached.at < this.showTtlMs) {
        return Promise.resolve(cached.data);
      }
      const pending = this.showInflight.get(id);
      if (pending) {
        return pending;
      }
    }

    const promise = this.api
      .get<ApiResponse<TenantUser>>(Apiendpointd.userById(id))
      .then((res) => {
        this.showCache.set(id, { at: Date.now(), data: res });
        this.showInflight.delete(id);
        return res;
      })
      .catch((err) => {
        this.showInflight.delete(id);
        throw err;
      });

    this.showInflight.set(id, promise);
    return promise;
  }

  create(body: UserFormPayload): Promise<ApiResponse<TenantUser>> {
    return this.api.post(Apiendpointd.users, body).then((res) => {
      this.invalidateShowCache();
      return res as ApiResponse<TenantUser>;
    });
  }

  update(id: number, body: Partial<UserFormPayload>): Promise<ApiResponse<TenantUser>> {
    return this.api.post(Apiendpointd.userById(id), body).then((res) => {
      this.showCache.delete(id);
      this.showInflight.delete(id);
      return res as ApiResponse<TenantUser>;
    });
  }

  remove(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.userById(id)).then((res) => {
      this.showCache.delete(id);
      this.showInflight.delete(id);
      return res as ApiResponse<unknown>;
    });
  }

  userBookings(
    userId: number,
    page = 1,
    perPage = 50,
  ): Promise<ApiResponse<PaginatedPayload<unknown>>> {
    const qs = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    return this.api.get(`${Apiendpointd.userBookings(userId)}?${qs}`);
  }

  async userBookingsAll(userId: number, perPage = 50): Promise<unknown[]> {
    const all: unknown[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      const res = await this.userBookings(userId, page, perPage);
      const payload = this.unwrapPaginator(res.data);
      all.push(...payload.rows);
      lastPage = payload.lastPage;
      page += 1;
    } while (page <= lastPage);

    return all;
  }

  private unwrapPaginator(raw: unknown): { rows: unknown[]; lastPage: number } {
    if (Array.isArray(raw)) {
      return { rows: raw, lastPage: 1 };
    }

    const payload = (raw || {}) as PaginatedPayload<unknown>;
    const rows = Array.isArray(payload.data) ? payload.data : [];

    return {
      rows,
      lastPage: Math.max(1, Number(payload.last_page ?? 1)),
    };
  }

  private invalidateShowCache(): void {
    this.showCache.clear();
    this.showInflight.clear();
  }

  private unwrapPage(raw: unknown): UsersPage {
    const res = (raw || {}) as {
      success?: boolean;
      message?: string;
      data?: TenantUser[] | { data?: TenantUser[]; total?: number };
      total?: number;
      current_page?: number;
      last_page?: number;
      per_page?: number;
    };

    if (Array.isArray(res.data)) {
      const data = this.withoutPlatformAdmins(res.data);
      return {
        success: res.success,
        message: res.message,
        data,
        total: this.adjustedTotal(res.total ?? res.data.length, res.data.length, data.length),
        current_page: res.current_page,
        last_page: res.last_page,
        per_page: res.per_page,
      };
    }

    const nested = res.data && typeof res.data === 'object' ? res.data : {};
    const rawRows = Array.isArray(nested.data) ? nested.data : [];
    const data = this.withoutPlatformAdmins(rawRows);
    return {
      success: res.success,
      message: res.message,
      data,
      total: this.adjustedTotal(nested.total ?? res.total ?? rawRows.length, rawRows.length, data.length),
      current_page: res.current_page,
      last_page: res.last_page,
      per_page: res.per_page,
    };
  }

  private withoutPlatformAdmins(rows: TenantUser[]): TenantUser[] {
    return rows.filter((u) => !u?.is_platform_admin);
  }

  private adjustedTotal(reported: number, before: number, after: number): number {
    return Math.max(0, reported - (before - after));
  }
}
