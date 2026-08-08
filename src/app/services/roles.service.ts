import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export interface SpatiePermission {
  id: number;
  name: string;
  guard_name: string;
}

export interface SpatieRole {
  id: number;
  name: string;
  guard_name: string;
  permissions?: SpatiePermission[];
}

export interface RolesPageBundle {
  roles: SpatieRole[];
  permissions: SpatiePermission[];
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly api = inject(ApiService);

  private readonly ttlMs = 60_000;

  private pageAt = 0;
  private pageData: RolesPageBundle | null = null;
  private pagePromise: Promise<RolesPageBundle> | null = null;

  invalidateCache(): void {
    this.pageAt = 0;
    this.pageData = null;
    this.pagePromise = null;
  }

  peekRolesPage(): RolesPageBundle | null {
    return this.pageData;
  }

  async getRolesPage(options?: { force?: boolean; allowStale?: boolean }): Promise<RolesPageBundle> {
    const force = options?.force === true;
    const allowStale = options?.allowStale !== false;
    const fresh = Date.now() - this.pageAt < this.ttlMs;

    if (!force && this.pageData && fresh) {
      return this.pageData;
    }

    if (!force && allowStale && this.pageData) {
      void this.fetchRolesPage();
      return this.pageData;
    }

    return this.fetchRolesPage();
  }

  listRoles(options?: { force?: boolean }): Promise<ApiResponse<SpatieRole[]>> {
    if (!options?.force && this.pageData && Date.now() - this.pageAt < this.ttlMs) {
      return Promise.resolve({
        success: true,
        message: '',
        code: 200,
        data: this.pageData.roles,
      });
    }

    return this.api.get<ApiResponse<SpatieRole[]>>(Apiendpointd.roles);
  }

  listPermissions(): Promise<ApiResponse<SpatiePermission[]>> {
    if (this.pageData && Date.now() - this.pageAt < this.ttlMs) {
      return Promise.resolve({
        success: true,
        message: '',
        code: 200,
        data: this.pageData.permissions,
      });
    }

    return this.api.get<ApiResponse<SpatiePermission[]>>(Apiendpointd.permissions);
  }

  async createRole(body: { name: string; permissions?: string[] }): Promise<ApiResponse<SpatieRole>> {
    const res = await this.api.post<ApiResponse<SpatieRole>>(Apiendpointd.roles, body);
    this.invalidateCache();
    return res;
  }

  async updateRole(id: number, body: { name: string }): Promise<ApiResponse<SpatieRole>> {
    const res = await this.api.put<ApiResponse<SpatieRole>>(Apiendpointd.roleById(id), body);
    this.invalidateCache();
    return res;
  }

  async deleteRole(id: number): Promise<ApiResponse<unknown>> {
    const res = await this.api.delete<ApiResponse<unknown>>(Apiendpointd.roleById(id));
    this.invalidateCache();
    return res;
  }

  async syncPermissions(roleName: string, permissions: string[]): Promise<ApiResponse<SpatieRole>> {
    const res = await this.api.post<ApiResponse<SpatieRole>>(Apiendpointd.rolesSync, {
      role_name: roleName,
      permissions,
    });
    this.invalidateCache();
    return res;
  }

  async createPermission(name: string, guard_name = 'admin-api'): Promise<ApiResponse<SpatiePermission>> {
    const res = await this.api.post<ApiResponse<SpatiePermission>>(Apiendpointd.permissions, { name, guard_name });
    this.invalidateCache();
    return res;
  }

  private fetchRolesPage(): Promise<RolesPageBundle> {
    if (this.pagePromise) {
      return this.pagePromise;
    }

    this.pagePromise = this.api
      .get<ApiResponse<RolesPageBundle>>(Apiendpointd.rolesPage)
      .then((res) => {
        this.pageData = {
          roles: res?.data?.roles ?? [],
          permissions: res?.data?.permissions ?? [],
        };
        this.pageAt = Date.now();
        this.pagePromise = null;
        return this.pageData;
      })
      .catch((err) => {
        this.pagePromise = null;
        throw err;
      });

    return this.pagePromise;
  }
}
