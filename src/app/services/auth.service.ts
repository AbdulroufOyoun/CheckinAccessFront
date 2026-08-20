import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { TenantModuleName, User } from '../model/User';
import { ApiResponse } from '../interfaces/api-response';

interface MePayload {
  admin: Partial<User>;
  roles: string[];
  permissions: string[];
  modules: TenantModuleName[];
  tenant_id?: string | number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private get storage(): Storage | null {
    return isPlatformBrowser(this.platformId) ? localStorage : null;
  }

  private static readonly ME_BOOTSTRAP_KEY = 'ca_admin_me_bootstrapped';
  private static readonly ME_AT_KEY = 'ca_admin_me_at';

  saveUser(token: string, user: User): void {
    this.storage?.setItem('token', token);
    this.storage?.setItem('user', JSON.stringify(user));
    this.meUser = user;
    this.meCachedAt = Date.now();
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem(AuthService.ME_AT_KEY, String(this.meCachedAt));
    }
  }

  getToken(): string | null {
    return this.storage?.getItem('token') ?? null;
  }

  getUser(): User | null {
    const raw = this.storage?.getItem('user');
    if (!raw) return null;
    try {
      return new User(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  hasModule(module: TenantModuleName): boolean {
    return this.getUser()?.hasModule(module) ?? false;
  }

  can(permission: string): boolean {
    return this.getUser()?.can(permission) ?? false;
  }

  canAny(...permissions: string[]): boolean {
    return this.getUser()?.canAny(permissions) ?? false;
  }

  private mePromise: Promise<User> | null = null;
  private meCachedAt = 0;
  private meUser: User | null = null;
  private static readonly ME_TTL_MS = 300_000;

  constructor() {
    this.hydrateMeFromStorage();
  }

  private hydrateMeFromStorage(): void {
    const user = this.getUser();
    if (!user) return;
    this.meUser = user;
    if (!isPlatformBrowser(this.platformId)) return;
    const at = Number(sessionStorage.getItem(AuthService.ME_AT_KEY) || 0);
    this.meCachedAt = at || Date.now();
  }

  private isMeProfileReady(user: User | null): boolean {
    return !!user && Array.isArray(user.permissions) && Array.isArray(user.modules);
  }

  private isMeBootstrapped(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return sessionStorage.getItem(AuthService.ME_BOOTSTRAP_KEY) === '1';
  }

  private markMeBootstrapped(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    sessionStorage.setItem(AuthService.ME_BOOTSTRAP_KEY, '1');
    sessionStorage.setItem(AuthService.ME_AT_KEY, String(this.meCachedAt));
  }

  /** Use cached profile when available; only hits /me when needed (login or stale session). */
  async ensureMe(): Promise<User> {
    this.hydrateMeFromStorage();
    const cached = this.meUser ?? this.getUser();
    if (cached && this.isMeProfileReady(cached) && this.isMeBootstrapped()) {
      this.meUser = cached;
      return cached;
    }
    return this.refreshMe();
  }

  async refreshMe(force = false): Promise<User> {
    const now = Date.now();
    if (!force && this.meUser && this.isMeProfileReady(this.meUser) && this.isMeBootstrapped()) {
      return this.meUser;
    }
    if (!force && this.meUser && now - this.meCachedAt < AuthService.ME_TTL_MS) {
      return this.meUser;
    }
    if (this.mePromise) {
      return this.mePromise;
    }

    this.mePromise = (async () => {
      const result = await this.api.get<ApiResponse<MePayload>>(Apiendpointd.me);
      const data = result.data;
      const current = this.getUser();
      const user = new User({
        ...(data.admin || {}),
        id: data.admin?.id ?? current?.id,
        name: data.admin?.name ?? current?.name ?? '',
        email: data.admin?.email ?? current?.email ?? '',
        mobile: data.admin?.mobile ?? current?.mobile ?? '',
        active: data.admin?.active ?? current?.active ?? true,
        roles: data.roles || [],
        permissions: data.permissions || [],
        modules: data.modules || [],
        tenant_id: data.tenant_id ?? current?.tenant_id ?? null,
      });
      const token = this.getToken();
      if (token) {
        this.saveUser(token, user);
      }
      this.meUser = user;
      this.meCachedAt = Date.now();
      this.markMeBootstrapped();
      return user;
    })().catch((err) => {
      throw err;
    }).finally(() => {
      this.mePromise = null;
    });

    return this.mePromise;
  }

  homeRoute(): string {
    if (this.hasModule('property')) return '/Dashboard';
    if (this.hasModule('education')) return '/Education/Subjects';
    return '/Dashboard';
  }

  logout(): void {
    this.mePromise = null;
    this.meCachedAt = 0;
    this.meUser = null;
    this.storage?.removeItem('token');
    this.storage?.removeItem('user');
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(AuthService.ME_BOOTSTRAP_KEY);
      sessionStorage.removeItem(AuthService.ME_AT_KEY);
    }
    void this.router.navigate(['/Login']);
  }
}
