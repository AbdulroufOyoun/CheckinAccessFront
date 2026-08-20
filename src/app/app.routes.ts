import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { authGuard, guestGuard, moduleGuard, moduleGuardAny, permissionGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'Login', pathMatch: 'full' },

  { path: 'Login', component: Login, canActivate: [guestGuard] },
  {
    path: 'OtpVerification',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./auth/otp-verification/otp-verification').then((m) => m.OtpVerification),
  },

  {
    path: '',
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      {
        path: 'Dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'Settings',
        loadComponent: () => import('./settings/settings-page').then((m) => m.SettingsPage),
      },

      {
        path: 'Reservations',
        canActivate: [moduleGuard('property'), permissionGuard('manage bookings')],
        loadComponent: () =>
          import('./layout/reservations-page-component/reservations-page-component').then(
            (m) => m.ReservationsPageComponent,
          ),
      },

      {
        path: 'Reservations/New',
        canActivate: [moduleGuard('property'), permissionGuard('manage bookings')],
        loadComponent: () =>
          import('./bookings/booking-create-page').then((m) => m.BookingCreatePage),
      },

      {
        path: 'RoomStatus',
        canActivate: [
          moduleGuard('property'),
          permissionGuard('manage bookings', 'view buildings', 'manage buildings'),
        ],
        loadComponent: () =>
          import('./room-status/room-status-page').then((m) => m.RoomStatusPage),
      },
      {
        path: 'RoomStatus/:id',
        canActivate: [
          moduleGuard('property'),
          permissionGuard('manage bookings', 'view buildings', 'manage buildings'),
        ],
        loadComponent: () =>
          import('./room-status/room-detail-page').then((m) => m.RoomDetailPage),
      },

      {
        path: 'Holidays',
        canActivate: [moduleGuard('property'), permissionGuard('manage bookings')],
        loadComponent: () => import('./holidays/holidays-page').then((m) => m.HolidaysPage),
      },

      {
        path: 'Durations',
        canActivate: [
          moduleGuardAny('property', 'education'),
          permissionGuard('manage bookings', 'manage education'),
        ],
        loadComponent: () => import('./durations/durations-page').then((m) => m.DurationsPage),
      },

      {
        path: 'Users',
        canActivate: [permissionGuard('manage users')],
        loadComponent: () => import('./users/users').then((m) => m.Users),
      },
      {
        path: 'Users/:id',
        canActivate: [permissionGuard('manage users')],
        loadComponent: () => import('./users/user-detail-page').then((m) => m.UserDetailPage),
      },

      {
        path: 'Admins',
        canActivate: [permissionGuard('manage admins')],
        loadComponent: () => import('./admins/admins-page').then((m) => m.AdminsPage),
      },

      {
        path: 'Roles',
        canActivate: [permissionGuard('manage roles')],
        loadComponent: () => import('./roles/roles-page').then((m) => m.RolesPage),
      },

      {
        path: 'Reports',
        canActivate: [moduleGuard('property'), permissionGuard('view reports')],
        loadComponent: () => import('./reports/reports').then((m) => m.Reports),
      },

      {
        path: 'Property',
        canActivate: [
          moduleGuard('property'),
          permissionGuard(
            'manage buildings',
            'view buildings',
            'manage rooms',
            'view rooms',
            'manage compounds',
            'view compounds',
          ),
        ],
        loadComponent: () =>
          import('./property/property-console/property-console').then((m) => m.PropertyConsole),
      },
      {
        path: 'Locks',
        canActivate: [moduleGuard('property'), permissionGuard('manage locks')],
        loadComponent: () =>
          import('./property/locks-page/locks-page').then((m) => m.LocksPage),
      },
      {
        path: 'FacilitiesManagement',
        redirectTo: 'Property',
        pathMatch: 'full',
      },

      {
        path: 'Education/Subjects',
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
        loadComponent: () =>
          import('./education/subjects/subjects-page').then((m) => m.SubjectsPage),
      },
      {
        path: 'Education/Sections',
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
        loadComponent: () =>
          import('./education/sections/sections-page').then((m) => m.SectionsPage),
      },
      {
        path: 'Education/Schedule',
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
        loadComponent: () =>
          import('./education/schedule/schedule-page').then((m) => m.SchedulePage),
      },
      {
        path: 'Education/Enrollments',
        canActivate: [moduleGuard('education'), permissionGuard('manage enrollments')],
        loadComponent: () =>
          import('./education/enrollments/enrollments-page').then((m) => m.EnrollmentsPage),
      },
      {
        path: 'Education/Terms',
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
        loadComponent: () =>
          import('./education/academic-terms/academic-terms-page').then((m) => m.AcademicTermsPage),
      },
      {
        path: 'Education/EnrollmentHistory',
        canActivate: [moduleGuard('education'), permissionGuard('manage enrollments')],
        loadComponent: () =>
          import('./education/enrollment-history/enrollment-history-page').then(
            (m) => m.EnrollmentHistoryPage,
          ),
      },
      {
        path: 'CompoundAccess',
        canActivate: [
          moduleGuardAny('property', 'education'),
          permissionGuard('manage education', 'manage compounds', 'manage locks'),
        ],
        loadComponent: () =>
          import('./education/compound-access/compound-access-page').then((m) => m.CompoundAccessPage),
      },
      {
        path: 'Education/CompoundAccess',
        redirectTo: 'CompoundAccess',
        pathMatch: 'full',
      },
      {
        path: 'Education/Reports',
        canActivate: [moduleGuard('education'), permissionGuard('view education reports')],
        loadComponent: () =>
          import('./education/reports/education-reports-page').then((m) => m.EducationReportsPage),
      },
    ],
  },
];
