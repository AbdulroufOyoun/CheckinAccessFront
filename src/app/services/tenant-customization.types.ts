export type AppLang = 'ar' | 'en';

export interface LocalizedText {
  ar: string;
  en: string;
}

export interface TenantAppearance {
  primary_color?: string;
  sidebar_color_start?: string;
  sidebar_color_end?: string;
  surface_bg?: string;
  app_name?: LocalizedText;
  app_subtitle?: LocalizedText;
  logo_url?: string | null;
}

export interface NavConfigItem {
  id: string;
  hidden?: boolean;
  order?: number;
}

export interface DashboardWidgetConfig {
  id: string;
  visible?: boolean;
  order?: number;
}

export interface TenantRegionalSettings {
  timezone?: string;
  default_lang?: AppLang;
  date_preset?: string;
  time_preset?: string;
  hour12?: boolean;
}

export interface TenantWelcomeSettings {
  enabled?: boolean;
  style?: 'info' | 'success' | 'warning';
  dismissible?: boolean;
  title?: LocalizedText;
  body?: LocalizedText;
  show_until?: string | null;
}

export interface TenantPdfSettings {
  show_logo?: boolean;
  header_text?: LocalizedText;
  footer_text?: LocalizedText;
  primary_color?: string | null;
}

export interface TenantOnboardingSettings {
  completed?: boolean;
  profile_id?: string | null;
  establishment_step_done?: boolean;
  property_structure_done?: boolean;
  property_structure_skipped?: boolean;
  completed_at?: string | null;
}

export interface PropertyOnboardingProvisionPayload {
  room_types: string[];
  compounds_count: number;
  buildings_per_compound: number;
  floors_per_building: number;
  rooms_per_floor: number;
  default_capacity?: number;
}

export interface EstablishmentPresetCard {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
}

export interface TenantCustomizationPayload {
  schema_version?: number;
  appearance?: TenantAppearance;
  label_overrides?: { ar: Record<string, string>; en: Record<string, string> };
  terminology?: Record<string, LocalizedText>;
  navigation?: { items: NavConfigItem[] };
  regional?: TenantRegionalSettings;
  welcome?: TenantWelcomeSettings;
  dashboard?: { widgets: DashboardWidgetConfig[] };
  pdf?: TenantPdfSettings;
  onboarding?: TenantOnboardingSettings;
}

export interface TenantPublicConfig {
  tenant_id?: string;
  appearance?: TenantAppearance;
  regional?: TenantRegionalSettings;
}
