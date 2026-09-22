import { TenantAppearance } from './tenant-customization.types';

const DEFAULT_PRIMARY = '#2563eb';
const DEFAULT_PRIMARY_DARK = '#1d4ed8';
const DEFAULT_PRIMARY_LIGHT = '#3b82f6';
const DEFAULT_SURFACE = '#eef2f9';
const DEFAULT_SIDEBAR_START = '#0c1a3a';
const DEFAULT_SIDEBAR_END = '#0e2247';

export function normalizeHex(hex: string | undefined | null): string | null {
  if (!hex) {
    return null;
  }
  const raw = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    return null;
  }
  return `#${raw.toLowerCase()}`;
}

export function hexToRgbCsv(hex: string): string | null {
  const n = normalizeHex(hex);
  if (!n) {
    return null;
  }
  const body = n.slice(1);
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** percent: negative = darker, positive = lighter (mix toward white). */
export function shadeHex(hex: string, percent: number): string {
  const n = normalizeHex(hex);
  if (!n) {
    return hex;
  }
  const body = n.slice(1);
  let r = parseInt(body.slice(0, 2), 16);
  let g = parseInt(body.slice(2, 4), 16);
  let b = parseInt(body.slice(4, 6), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.min(1, Math.abs(percent) / 100);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function applyTenantBrandCssVariables(
  root: HTMLElement,
  appearance: TenantAppearance | null | undefined,
): void {
  const primary = normalizeHex(appearance?.primary_color) ?? DEFAULT_PRIMARY;
  const primaryDark = shadeHex(primary, -14);
  const primaryLight = shadeHex(primary, 12);
  const surface = normalizeHex(appearance?.surface_bg) ?? DEFAULT_SURFACE;
  const sidebarStart =
    normalizeHex(appearance?.sidebar_color_start) ?? DEFAULT_SIDEBAR_START;
  const sidebarEnd =
    normalizeHex(appearance?.sidebar_color_end) ?? shadeHex(sidebarStart, -12);

  const primaryRgb = hexToRgbCsv(primary) ?? '37, 99, 235';
  const gradient = `linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%)`;
  const sidebarBg = `linear-gradient(180deg, ${sidebarStart} 0%, ${sidebarEnd} 100%)`;
  const authGradient = `linear-gradient(135deg, ${primaryDark} 0%, var(--teal-500, #0d9488) 100%)`;
  const authGradientH = `linear-gradient(90deg, ${primary} 0%, var(--teal-500, #0d9488) 100%)`;

  const set = (name: string, value: string) => root.style.setProperty(name, value);

  set('--tenant-primary', primary);
  set('--tenant-primary-dark', primaryDark);
  set('--tenant-primary-light', primaryLight);
  set('--tenant-primary-rgb', primaryRgb);
  set('--tenant-navy', sidebarStart);
  set('--tenant-gradient', gradient);
  set('--tenant-gradient-auth', authGradient);
  set('--tenant-gradient-auth-h', authGradientH);

  set('--bs-primary', primary);
  set('--bs-primary-rgb', primaryRgb);
  set('--primary', primary);
  set('--primary-dark', primaryDark);
  set('--blue-500', primaryLight);
  set('--blue-600', primary);
  set('--blue-700', primaryDark);

  set('--surface-bg', surface);
  set('--bg-page', surface);

  set('--sidebar-color-start', sidebarStart);
  set('--sidebar-color-end', sidebarEnd);
  set('--sidebar-bg', sidebarBg);

  set('--rp-navy', sidebarStart);
  set('--hol-navy', sidebarStart);
  set('--bc-accent', primary);
  set('--ud-accent', primary);
}
