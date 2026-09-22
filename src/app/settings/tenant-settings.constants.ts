export type TenantLabelGroupId = 'nav' | 'dashboard' | 'property' | 'education' | 'admin';

export interface TenantLabelGroup {
  id: TenantLabelGroupId;
  titleKey: string;
  hintKey: string;
  keys: readonly string[];
}

/** Grouped menu/page labels for the tenant customization UI. */
export const TENANT_LABEL_GROUPS: TenantLabelGroup[] = [
  {
    id: 'nav',
    titleKey: 'SET_TENANT_LABELS_GROUP_NAV',
    hintKey: 'SET_TENANT_LABELS_GROUP_NAV_HINT',
    keys: [
      'NAV_SECTION_OVERVIEW',
      'NAV_SECTION_PROPERTY',
      'NAV_SECTION_EDUCATION',
      'NAV_SECTION_ADMIN',
    ],
  },
  {
    id: 'dashboard',
    titleKey: 'SET_TENANT_LABELS_GROUP_DASHBOARD',
    hintKey: 'SET_TENANT_LABELS_GROUP_DASHBOARD_HINT',
    keys: ['DASHBOARD', 'DASH_SUB_PROP', 'DASH_SUB_EDU', 'DASH_SUB_BOTH'],
  },
  {
    id: 'property',
    titleKey: 'SET_TENANT_LABELS_GROUP_PROPERTY',
    hintKey: 'SET_TENANT_LABELS_GROUP_PROPERTY_HINT',
    keys: [
      'DUR_NAV',
      'RESERVATIONS',
      'BOOK_VIEW_DELETED',
      'ROOM_STATUS_NAV',
      'HOL_NAV',
      'PROP_NAV',
      'LOCKS_NAV',
      'REPORTS',
      'REP_TITLE',
      'COMPOUND_ACCESS_NAV',
    ],
  },
  {
    id: 'education',
    titleKey: 'SET_TENANT_LABELS_GROUP_EDUCATION',
    hintKey: 'SET_TENANT_LABELS_GROUP_EDUCATION_HINT',
    keys: [
      'EDU_SUBJECTS',
      'EDU_SECTIONS',
      'EDU_SCHEDULE',
      'EDU_ENROLLMENTS',
      'EDU_TERMS',
      'EDU_ENROLLMENT_HISTORY',
      'EDU_EVENTS',
      'EDU_REPORTS',
    ],
  },
  {
    id: 'admin',
    titleKey: 'SET_TENANT_LABELS_GROUP_ADMIN',
    hintKey: 'SET_TENANT_LABELS_GROUP_ADMIN_HINT',
    keys: ['USERS', 'ADMINS', 'ROLES_PERMISSIONS', 'SETTINGS', 'SET_TITLE'],
  },
];

export const TENANT_LABEL_KEYS = [
  'DASHBOARD',
  'DUR_NAV',
  'RESERVATIONS',
  'BOOK_VIEW_DELETED',
  'ROOM_STATUS_NAV',
  'HOL_NAV',
  'PROP_NAV',
  'LOCKS_NAV',
  'REPORTS',
  'EDU_SUBJECTS',
  'EDU_SECTIONS',
  'EDU_SCHEDULE',
  'EDU_ENROLLMENTS',
  'EDU_TERMS',
  'EDU_ENROLLMENT_HISTORY',
  'EDU_EVENTS',
  'EDU_REPORTS',
  'USERS',
  'COMPOUND_ACCESS_NAV',
  'ADMINS',
  'ROLES_PERMISSIONS',
  'SETTINGS',
  'NAV_SECTION_OVERVIEW',
  'NAV_SECTION_PROPERTY',
  'NAV_SECTION_EDUCATION',
  'NAV_SECTION_ADMIN',
  'SET_TITLE',
  'DASH_SUB_PROP',
  'DASH_SUB_EDU',
  'DASH_SUB_BOTH',
  'REP_TITLE',
] as const;

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
