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

  userBookings(userId: number): Promise<ApiResponse<{ data?: unknown[] } | unknown[]>> {
    return this.api.get(Apiendpointd.userBookings(userId));
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
      return {
        success: res.success,
        message: res.message,
        data: res.data,
        total: res.total ?? res.data.length,
        current_page: res.current_page,
        last_page: res.last_page,
        per_page: res.per_page,
      };
    }

    const nested = res.data && typeof res.data === 'object' ? res.data : {};
    const rows = Array.isArray(nested.data) ? nested.data : [];
    return {
      success: res.success,
      message: res.message,
      data: rows,
      total: nested.total ?? res.total ?? rows.length,
      current_page: res.current_page,
      last_page: res.last_page,
      per_page: res.per_page,
    };
  }
}
