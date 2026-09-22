/** Navigation items for tenant settings — labelKeys match app-shell sidebar. */
export interface TenantNavCatalogEntry {
  id: string;
  labelKey: string;
  sectionId: 'overview' | 'property' | 'education' | 'admin';
  sectionLabelKey: string;
}

export const TENANT_NAV_CATALOG: TenantNavCatalogEntry[] = [
  { id: 'dashboard', labelKey: 'DASHBOARD', sectionId: 'overview', sectionLabelKey: 'NAV_SECTION_OVERVIEW' },
  { id: 'durations', labelKey: 'DUR_NAV', sectionId: 'overview', sectionLabelKey: 'NAV_SECTION_OVERVIEW' },
  { id: 'reservations', labelKey: 'RESERVATIONS', sectionId: 'property', sectionLabelKey: 'NAV_SECTION_PROPERTY' },
  { id: 'reservations_deleted', labelKey: 'BOOK_VIEW_DELETED', sectionId: 'property', sectionLabelKey: 'NAV_SECTION_PROPERTY' },
  { id: 'room_status', labelKey: 'ROOM_STATUS_NAV', sectionId: 'property', sectionLabelKey: 'NAV_SECTION_PROPERTY' },
  { id: 'holidays', labelKey: 'HOL_NAV', sectionId: 'property', sectionLabelKey: 'NAV_SECTION_PROPERTY' },
  { id: 'property', labelKey: 'PROP_NAV', sectionId: 'property', sectionLabelKey: 'NAV_SECTION_PROPERTY' },
  { id: 'locks', labelKey: 'LOCKS_NAV', sectionId: 'property', sectionLabelKey: 'NAV_SECTION_PROPERTY' },
  { id: 'reports', labelKey: 'REPORTS', sectionId: 'property', sectionLabelKey: 'NAV_SECTION_PROPERTY' },
  { id: 'edu_subjects', labelKey: 'EDU_SUBJECTS', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'edu_sections', labelKey: 'EDU_SECTIONS', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'edu_schedule', labelKey: 'EDU_SCHEDULE', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'edu_enrollments', labelKey: 'EDU_ENROLLMENTS', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'edu_terms', labelKey: 'EDU_TERMS', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'edu_enrollment_history', labelKey: 'EDU_ENROLLMENT_HISTORY', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'edu_events', labelKey: 'EDU_EVENTS', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'edu_reports', labelKey: 'EDU_REPORTS', sectionId: 'education', sectionLabelKey: 'NAV_SECTION_EDUCATION' },
  { id: 'users', labelKey: 'USERS', sectionId: 'admin', sectionLabelKey: 'NAV_SECTION_ADMIN' },
  { id: 'compound_access', labelKey: 'COMPOUND_ACCESS_NAV', sectionId: 'admin', sectionLabelKey: 'NAV_SECTION_ADMIN' },
  { id: 'admins', labelKey: 'ADMINS', sectionId: 'admin', sectionLabelKey: 'NAV_SECTION_ADMIN' },
  { id: 'roles', labelKey: 'ROLES_PERMISSIONS', sectionId: 'admin', sectionLabelKey: 'NAV_SECTION_ADMIN' },
];

export interface TenantNavSectionForEdit {
  sectionId: TenantNavCatalogEntry['sectionId'];
  sectionLabelKey: string;
  items: TenantNavCatalogEntry[];
}

export interface TenantWidgetCatalogEntry {
  id: string;
  labelKey: string;
}

export const TENANT_WIDGET_CATALOG: TenantWidgetCatalogEntry[] = [
  { id: 'module_cards', labelKey: 'SET_TENANT_WIDGET_MODULE_CARDS' },
  { id: 'kpi_cards', labelKey: 'SET_TENANT_WIDGET_KPI' },
  { id: 'room_grid', labelKey: 'SET_TENANT_WIDGET_ROOM_GRID' },
  { id: 'occupancy_chart', labelKey: 'SET_TENANT_WIDGET_OCCUPANCY' },
  { id: 'quick_actions', labelKey: 'SET_TENANT_WIDGET_QUICK_ACTIONS' },
  { id: 'activity_panel', labelKey: 'SET_TENANT_WIDGET_ACTIVITY' },
  { id: 'smart_alerts', labelKey: 'SET_TENANT_WIDGET_ALERTS' },
  { id: 'edu_module_cards', labelKey: 'SET_TENANT_WIDGET_EDU_CARDS' },
];

const SECTION_ORDER: TenantNavCatalogEntry['sectionId'][] = [
  'overview',
  'property',
  'education',
  'admin',
];

export function buildNavSectionsForEdit(
  navOrder: Record<string, number>,
): TenantNavSectionForEdit[] {
  const bySection = new Map<string, TenantNavCatalogEntry[]>();
  for (const entry of TENANT_NAV_CATALOG) {
    const list = bySection.get(entry.sectionId) ?? [];
    list.push(entry);
    bySection.set(entry.sectionId, list);
  }

  return SECTION_ORDER.map((sectionId) => {
    const items = [...(bySection.get(sectionId) ?? [])].sort((a, b) => {
      const orderA = navOrder[a.id] ?? 9999;
      const orderB = navOrder[b.id] ?? 9999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return TENANT_NAV_CATALOG.findIndex((e) => e.id === a.id) - TENANT_NAV_CATALOG.findIndex((e) => e.id === b.id);
    });
    const sectionLabelKey = items[0]?.sectionLabelKey ?? 'NAV_SECTION_OVERVIEW';
    return { sectionId, sectionLabelKey, items };
  }).filter((s) => s.items.length > 0);
}

export function reorderNavSectionItems(
  section: TenantNavSectionForEdit,
  previousIndex: number,
  currentIndex: number,
): TenantNavSectionForEdit {
  const items = [...section.items];
  const [moved] = items.splice(previousIndex, 1);
  items.splice(currentIndex, 0, moved);
  return { ...section, items };
}

export function applyNavSectionOrderToMap(
  sections: TenantNavSectionForEdit[],
  navOrder: Record<string, number>,
): void {
  for (const section of sections) {
    section.items.forEach((item, index) => {
      navOrder[item.id] = (index + 1) * 10;
    });
  }
}
