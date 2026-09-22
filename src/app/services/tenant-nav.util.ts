/** Maps sidebar routes to stable navigation config ids (server catalog). */
export const ROUTE_TO_NAV_ID: Record<string, string> = {
  '/Dashboard': 'dashboard',
  '/Durations': 'durations',
  '/Reservations': 'reservations',
  '/Reservations/Deleted': 'reservations_deleted',
  '/RoomStatus': 'room_status',
  '/Holidays': 'holidays',
  '/Property': 'property',
  '/Locks': 'locks',
  '/Reports': 'reports',
  '/Education/Subjects': 'edu_subjects',
  '/Education/Sections': 'edu_sections',
  '/Education/Schedule': 'edu_schedule',
  '/Education/Enrollments': 'edu_enrollments',
  '/Education/Terms': 'edu_terms',
  '/Education/EnrollmentHistory': 'edu_enrollment_history',
  '/Education/Events': 'edu_events',
  '/Education/Reports': 'edu_reports',
  '/Users': 'users',
  '/CompoundAccess': 'compound_access',
  '/Admins': 'admins',
  '/Roles': 'roles',
};

export interface NavSectionLike {
  id: string;
  labelKey: string;
  items: NavItemLike[];
}

export interface NavItemLike {
  navId?: string;
  labelKey: string;
  route: string;
  visible: boolean;
  icon?: string;
}

export function applyNavigationCustomization<T extends NavSectionLike>(
  sections: T[],
  navItems: { id: string; hidden?: boolean; order?: number }[] | undefined,
): T[] {
  if (!navItems?.length) {
    return sections;
  }
  const byId = new Map(navItems.map((n) => [n.id, n]));

  return sections
    .map((section) => {
      const items = section.items
        .filter((item) => {
          const id = item.navId ?? ROUTE_TO_NAV_ID[item.route];
          if (!id) {
            return true;
          }
          const cfg = byId.get(id);
          if (!cfg?.hidden) {
            return true;
          }
          return false;
        })
        .sort((a, b) => {
          const idA = a.navId ?? ROUTE_TO_NAV_ID[a.route] ?? '';
          const idB = b.navId ?? ROUTE_TO_NAV_ID[b.route] ?? '';
          const orderA = byId.get(idA)?.order ?? 9999;
          const orderB = byId.get(idB)?.order ?? 9999;
          return orderA - orderB;
        });
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
}
