import {
  TENANT_LABEL_GROUPS_GENERATED,
  TENANT_LABEL_KEYS_GENERATED,
  TENANT_LABEL_MODULES,
  type TenantLabelModule,
} from './tenant-label-catalog.generated';

export type { TenantLabelModule };
export { TENANT_LABEL_MODULES, TENANT_LABEL_META } from './tenant-label-catalog.generated';

export type TenantLabelGroupId = (typeof TENANT_LABEL_GROUPS_GENERATED)[number]['id'];

export interface TenantLabelGroup {
  id: TenantLabelGroupId | string;
  titleKey: string;
  hintKey: string;
  module: TenantLabelModule;
  keys: readonly string[];
}

/** Grouped menu/page labels for the tenant customization UI (generated from catalog). */
export const TENANT_LABEL_GROUPS: TenantLabelGroup[] = [...TENANT_LABEL_GROUPS_GENERATED];

export const TENANT_LABEL_KEYS = [...TENANT_LABEL_KEYS_GENERATED];

export const TENANT_NAV_IDS = [
  'dashboard',
  'durations',
  'reservations',
  'reservations_deleted',
  'room_status',
  'holidays',
  'property',
  'locks',
  'reports',
  'edu_subjects',
  'edu_sections',
  'edu_schedule',
  'edu_enrollments',
  'edu_terms',
  'edu_enrollment_history',
  'edu_events',
  'edu_reports',
  'users',
  'compound_access',
  'admins',
  'roles',
] as const;

export const TENANT_WIDGET_IDS = [
  'module_cards',
  'kpi_cards',
  'room_grid',
  'occupancy_chart',
  'quick_actions',
  'activity_panel',
  'smart_alerts',
  'edu_module_cards',
] as const;

export const TENANT_TERMINOLOGY_KEYS = [
  'entity.compound',
  'entity.building',
  'entity.floor',
  'entity.suite',
  'entity.room',
  'entity.facility',
  'entity.gate',
  'entity.booking',
  'entity.enrollment',
] as const;

export const TIMEZONE_OPTIONS = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Africa/Cairo',
  'Europe/London',
  'UTC',
] as const;
