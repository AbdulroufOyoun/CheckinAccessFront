import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import {
  TenantCustomizationPayload,
  TenantPublicConfig,
  AppLang,
  EstablishmentPresetCard,
  PropertyOnboardingProvisionPayload,
  TenantOnboardingSettings,
} from './tenant-customization.types';
import { LocaleService } from './locale.service';
import { applyTenantBrandCssVariables } from './tenant-brand.util';

@Injectable({ providedIn: 'root' })
export class TenantCustomizationService {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);

  private readonly settingsSignal = signal<TenantCustomizationPayload | null>(null);
  private readonly publicAppearanceSignal = signal<TenantCustomizationPayload['appearance'] | null>(null);
  private readonly logoCacheBust = signal(0);
  readonly settings = this.settingsSignal.asReadonly();

  /** Same host as admin API — avoids broken APP_URL in Laravel `logo_url`. */
  readonly logoDisplayUrl = computed(() => {
    const appearance = this.settingsSignal()?.appearance ?? this.publicAppearanceSignal();
    if (!appearance?.logo_url) {
      return null;
    }
    const bust = this.logoCacheBust();
    return bust > 0 ? `${Apiendpointd.tenantLogo}?v=${bust}` : Apiendpointd.tenantLogo;
  });

  async loadPublicConfig(): Promise<TenantPublicConfig | null> {
    try {
      const res = await this.api.get<ApiResponse<TenantPublicConfig>>(Apiendpointd.publicConfig);
      const data = res.data;
      if (data?.appearance) {
        this.publicAppearanceSignal.set(data.appearance);
        this.applyBranding(data.appearance);
        if (data.appearance.logo_url) {
          this.bumpLogoCacheBust();
        }
      }
      if (data?.regional?.default_lang) {
        this.applyDefaultLangIfUnset(data.regional.default_lang);
      }
      return data ?? null;
    } catch {
      return null;
    }
  }

  async loadSettings(force = false): Promise<TenantCustomizationPayload | null> {
    if (!force && this.settingsSignal()) {
      return this.settingsSignal();
    }
    try {
      const res = await this.api.get<ApiResponse<TenantCustomizationPayload>>(
        Apiendpointd.tenantSettings,
      );
      const data = res.data ?? null;
      this.settingsSignal.set(data);
      if (data) {
        this.applyFullSettings(data);
        if (data.appearance?.logo_url) {
          this.bumpLogoCacheBust();
        }
      }
      return data;
    } catch {
      return null;
    }
  }

  async saveSettings(patch: Partial<TenantCustomizationPayload>): Promise<TenantCustomizationPayload | null> {
    const res = await this.api.put<ApiResponse<TenantCustomizationPayload>>(
      Apiendpointd.tenantSettings,
      patch,
    );
    if (!res.success) {
      throw new Error(res.message || 'Save failed');
    }
    const data = res.data ?? null;
    this.settingsSignal.set(data);
    if (data) {
      this.applyFullSettings(data);
      if (data.appearance?.logo_url) {
        this.bumpLogoCacheBust();
      }
    }
    return data;
  }

  async uploadLogo(file: File): Promise<TenantCustomizationPayload | null> {
    const form = new FormData();
    form.append('logo', file);
    const res = await this.api.post<ApiResponse<TenantCustomizationPayload>>(
      Apiendpointd.tenantSettingsLogo,
      form,
    );
    if (!res.success) {
      throw new Error(res.message || 'Upload failed');
    }
    const data = res.data ?? null;
    this.settingsSignal.set(data);
    if (data) {
      this.applyFullSettings(data);
      if (data.appearance) {
        this.publicAppearanceSignal.set(data.appearance);
      }
      if (data.appearance?.logo_url) {
        this.bumpLogoCacheBust();
      }
    }
    return data;
  }

  applyFullSettings(data: TenantCustomizationPayload): void {
    if (data.appearance) {
      this.applyBranding(data.appearance);
    }
    this.mergeLabelOverrides(data);
    if (data.regional?.default_lang) {
      this.applyDefaultLangIfUnset(data.regional.default_lang);
    }
  }

  applyBranding(appearance: TenantCustomizationPayload['appearance']): void {
    if (typeof document === 'undefined') {
      return;
    }
    applyTenantBrandCssVariables(document.documentElement, appearance ?? undefined);
  }

  mergeLabelOverrides(data: TenantCustomizationPayload): void {
    const overrides = data.label_overrides;
    const terminology = data.terminology ?? {};
    if (overrides?.ar) {
      const merged = { ...overrides.ar };
      for (const [key, val] of Object.entries(terminology)) {
        if (val?.ar) {
          merged[key] = val.ar;
          merged[`SET_TENANT_TERM_${key}`] = val.ar;
        }
      }
      this.translate.setTranslation('ar', merged, true);
    }
    if (overrides?.en) {
      const merged = { ...overrides.en };
      for (const [key, val] of Object.entries(terminology)) {
        if (val?.en) {
          merged[key] = val.en;
          merged[`SET_TENANT_TERM_${key}`] = val.en;
        }
      }
      this.translate.setTranslation('en', merged, true);
    }
  }

  appName(lang?: AppLang): string {
    const l = lang ?? this.locale.lang();
    const appearance = this.settingsSignal()?.appearance ?? this.publicAppearanceSignal();
    const name = appearance?.app_name?.[l] || appearance?.app_name?.en;
    return name || (l === 'ar' ? 'نظام الإقامة' : 'Accommodation System');
  }

  appSubtitle(lang?: AppLang): string {
    const l = lang ?? this.locale.lang();
    const appearance = this.settingsSignal()?.appearance ?? this.publicAppearanceSignal();
    const sub = appearance?.app_subtitle?.[l] || appearance?.app_subtitle?.en;
    return sub || (l === 'ar' ? 'لوحة الإدارة' : 'Management System');
  }

  logoUrl(): string | null {
    return this.logoDisplayUrl();
  }

  private bumpLogoCacheBust(): void {
    this.logoCacheBust.set(Date.now());
  }

  welcomeSettings() {
    return this.settingsSignal()?.welcome;
  }

  regionalSettings() {
    return this.settingsSignal()?.regional;
  }

  navigationSettings() {
    return this.settingsSignal()?.navigation;
  }

  dashboardSettings() {
    return this.settingsSignal()?.dashboard;
  }

  onboardingSettings() {
    return this.settingsSignal()?.onboarding;
  }

  needsEstablishmentSetup(modules: string[], isSuperAdmin: boolean): boolean {
    if (!modules.includes('property') || !isSuperAdmin) {
      return false;
    }
    const o = this.settingsSignal()?.onboarding;
    if (o?.completed === true) {
      return false;
    }
    return o?.establishment_step_done !== true;
  }

  needsPropertyStructureSetup(modules: string[], isSuperAdmin: boolean): boolean {
    if (!modules.includes('property') || !isSuperAdmin) {
      return false;
    }
    const o = this.settingsSignal()?.onboarding;
    if (o?.completed === true) {
      return false;
    }
    return o?.establishment_step_done === true;
  }

  resolveOnboardingRoute(modules: string[], isSuperAdmin: boolean): string | null {
    if (this.needsEstablishmentSetup(modules, isSuperAdmin)) {
      return '/EstablishmentSetup';
    }
    if (this.needsPropertyStructureSetup(modules, isSuperAdmin)) {
      return '/PropertyOnboarding';
    }
    return null;
  }

  onboardingRouteFromSettings(
    onboarding: TenantOnboardingSettings | undefined,
    modules: string[],
    isSuperAdmin: boolean,
  ): string | null {
    if (!modules.includes('property') || !isSuperAdmin) {
      return null;
    }
    if (onboarding?.completed === true) {
      return null;
    }
    if (onboarding?.establishment_step_done !== true) {
      return '/EstablishmentSetup';
    }
    return '/PropertyOnboarding';
  }

  async loadEstablishmentPresets(): Promise<EstablishmentPresetCard[]> {
    const res = await this.api.get<ApiResponse<EstablishmentPresetCard[]>>(
      Apiendpointd.tenantEstablishmentPresets,
    );
    if (res.success === false) {
      throw new Error(res.message || 'Failed to load presets');
    }
    return res.data ?? [];
  }

  async applyEstablishmentPreset(
    presetId: string,
    defaultLang: AppLang,
  ): Promise<TenantCustomizationPayload | null> {
    const res = await this.api.post<ApiResponse<TenantCustomizationPayload>>(
      Apiendpointd.tenantApplyEstablishmentPreset,
      { preset_id: presetId, default_lang: defaultLang },
    );
    if (!res.success) {
      throw new Error(res.message || 'Apply preset failed');
    }
    const data = res.data ?? null;
    this.settingsSignal.set(data);
    if (data) {
      this.applyFullSettings(data);
    }
    return data;
  }

  async provisionPropertyStructure(
    payload: PropertyOnboardingProvisionPayload,
  ): Promise<TenantCustomizationPayload | null> {
    const res = await this.api.post<
      ApiResponse<{ stats: Record<string, number>; settings: TenantCustomizationPayload }>
    >(Apiendpointd.tenantPropertyOnboardingProvision, payload);
    if (!res.success) {
      throw new Error(res.message || 'Provision failed');
    }
    const settings = res.data?.settings ?? null;
    this.settingsSignal.set(settings);
    if (settings) {
      this.applyFullSettings(settings);
    }
    return settings;
  }

  async skipPropertyStructure(): Promise<TenantCustomizationPayload | null> {
    const res = await this.api.post<ApiResponse<TenantCustomizationPayload>>(
      Apiendpointd.tenantPropertyOnboardingSkip,
      {},
    );
    if (!res.success) {
      throw new Error(res.message || 'Skip failed');
    }
    const data = res.data ?? null;
    this.settingsSignal.set(data);
    if (data) {
      this.applyFullSettings(data);
    }
    return data;
  }

  isWidgetVisible(id: string, defaultVisible = true): boolean {
    const widgets = this.settingsSignal()?.dashboard?.widgets;
    if (!widgets?.length) {
      return defaultVisible;
    }
    const item = widgets.find((w) => w.id === id);
    if (!item) {
      return defaultVisible;
    }
    return item.visible !== false;
  }

  private applyDefaultLangIfUnset(lang: AppLang): void {
    try {
      const saved = localStorage.getItem('lang');
      if (saved === 'ar' || saved === 'en') {
        return;
      }
    } catch {
      /* ignore */
    }
    void this.locale.use(lang, false);
  }
}
