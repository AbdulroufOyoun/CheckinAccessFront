import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export interface AdminRole {
  id: number;
  name: string;
  guard_name?: string;
}

export interface TenantAdmin {
  id: number;
  name: string;
  email?: string | null;
  mobile?: string | null;
  active?: boolean | number;
  roles?: AdminRole[];
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminsService {
  private readonly api = inject(ApiService);

  list(options?: { excludeSuper?: boolean }): Promise<ApiResponse<TenantAdmin[]>> {
    const qs = options?.excludeSuper ? '?exclude_super=1' : '';
    return this.api.get(`${Apiendpointd.adminsList}${qs}`);
  }

  create(body: {
    name: string;
    mobile: string;
    email?: string | null;
    password: string;
    roles?: string[];
  }): Promise<ApiResponse<TenantAdmin>> {
    return this.api.post(Apiendpointd.adminsList, body);
  }

  update(body: {
    id: number;
    name?: string;
    mobile?: string;
    email?: string | null;
    password?: string;
    roles?: string[];
  }): Promise<ApiResponse<TenantAdmin>> {
    return this.api.post(Apiendpointd.adminsUpdate, body);
  }

  activate(id: number): Promise<ApiResponse<TenantAdmin>> {
    return this.api.post(Apiendpointd.adminsActive, { id });
  }

  deactivate(id: number): Promise<ApiResponse<TenantAdmin>> {
    return this.api.post(Apiendpointd.adminsInactive, { id });
  }

  resetPassword(body: {
    id: number;
    password: string;
    password_confirmation: string;
  }): Promise<ApiResponse<unknown>> {
    return this.api.post(Apiendpointd.adminsResetPassword, body);
  }

  changeOwnPassword(body: {
    old_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<ApiResponse<unknown>> {
    return this.api.post(Apiendpointd.adminsChangePassword, body);
  }
}
