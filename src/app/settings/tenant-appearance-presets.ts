export interface TenantAppearancePreset {
  id: string;
  labelKey: string;
  primary_color: string;
  sidebar_color: string;
  surface_bg: string;
}

/** Quick theme suggestions (colors only). */
export const TENANT_APPEARANCE_PRESETS: TenantAppearancePreset[] = [
  {
    id: 'classic_blue',
    labelKey: 'SET_TENANT_PRESET_CLASSIC',
    primary_color: '#2563eb',
    sidebar_color: '#0c1a3a',
    surface_bg: '#eef2f9',
  },
  {
    id: 'university',
    labelKey: 'SET_TENANT_PRESET_UNIVERSITY',
    primary_color: '#1d4ed8',
    sidebar_color: '#1e3a8a',
    surface_bg: '#eff6ff',
  },
  {
    id: 'corporate_teal',
    labelKey: 'SET_TENANT_PRESET_TEAL',
    primary_color: '#0f766e',
    sidebar_color: '#134e4a',
    surface_bg: '#ecfdf5',
  },
  {
    id: 'modern_purple',
    labelKey: 'SET_TENANT_PRESET_PURPLE',
    primary_color: '#7c3aed',
    sidebar_color: '#3b0764',
    surface_bg: '#f5f3ff',
  },
  {
    id: 'warm_sand',
    labelKey: 'SET_TENANT_PRESET_WARM',
    primary_color: '#c2410c',
    sidebar_color: '#292524',
    surface_bg: '#fffbeb',
  },
];
