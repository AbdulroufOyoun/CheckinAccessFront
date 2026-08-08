import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { AppShell } from './layout/app-shell/app-shell';
import { ReservationsPageComponent } from './layout/reservations-page-component/reservations-page-component';
import { OtpVerification } from './auth/otp-verification/otp-verification';
import { Login } from './auth/login/login';
import { Users } from './users/users';
import { UserDetailPage } from './users/user-detail-page';
import { Reports } from './reports/reports';
import { RoomStatusPage } from './room-status/room-status-page';
import { RoomDetailPage } from './room-status/room-detail-page';
import { HolidaysPage } from './holidays/holidays-page';
import { BookingCreatePage } from './bookings/booking-create-page';
import { PropertyConsole } from './property/property-console/property-console';
import { authGuard, guestGuard, moduleGuard, permissionGuard } from './guards/auth.guard';
import { SubjectsPage } from './education/subjects/subjects-page';
import { SectionsPage } from './education/sections/sections-page';
import { EnrollmentsPage } from './education/enrollments/enrollments-page';
import { EducationReportsPage } from './education/reports/education-reports-page';
import { SchedulePage } from './education/schedule/schedule-page';
import { AdminsPage } from './admins/admins-page';
import { RolesPage } from './roles/roles-page';
import { SettingsPage } from './settings/settings-page';
import { AcademicTermsPage } from './education/academic-terms/academic-terms-page';
import { EnrollmentHistoryPage } from './education/enrollment-history/enrollment-history-page';

export const routes: Routes = [
  { path: '', redirectTo: 'Login', pathMatch: 'full' },

  { path: 'Login', component: Login, canActivate: [guestGuard] },
  { path: 'OtpVerification', component: OtpVerification, canActivate: [guestGuard] },

  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: 'Dashboard', component: Dashboard },
      { path: 'Settings', component: SettingsPage },

      {
        path: 'Reservations',
        component: ReservationsPageComponent,
        canActivate: [moduleGuard('property')],
      },

      {
        path: 'Reservations/New',
        component: BookingCreatePage,
        canActivate: [moduleGuard('property')],
      },

      {
        path: 'RoomStatus',
        component: RoomStatusPage,
        canActivate: [moduleGuard('property')],
      },
      {
        path: 'RoomStatus/:id',
        component: RoomDetailPage,
        canActivate: [moduleGuard('property')],
      },

      {
        path: 'Holidays',
        component: HolidaysPage,
        canActivate: [moduleGuard('property')],
      },

      {
        path: 'Users',
        component: Users,
        canActivate: [permissionGuard('manage users')],
      },
      {
        path: 'Users/:id',
        component: UserDetailPage,
        canActivate: [permissionGuard('manage users')],
      },

      {
        path: 'Admins',
        component: AdminsPage,
        canActivate: [permissionGuard('manage admins')],
      },

      {
        path: 'Roles',
        component: RolesPage,
        canActivate: [permissionGuard('manage roles')],
      },

      {
        path: 'Reports',
        component: Reports,
        canActivate: [moduleGuard('property')],
      },

      {
        path: 'Property',
        component: PropertyConsole,
        canActivate: [moduleGuard('property')],
      },
      {
        path: 'FacilitiesManagement',
        redirectTo: 'Property',
        pathMatch: 'full',
      },

      {
        path: 'Education/Subjects',
        component: SubjectsPage,
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
      },
      {
        path: 'Education/Sections',
        component: SectionsPage,
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
      },
      {
        path: 'Education/Schedule',
        component: SchedulePage,
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
      },
      {
        path: 'Education/Enrollments',
        component: EnrollmentsPage,
        canActivate: [moduleGuard('education'), permissionGuard('manage enrollments')],
      },
      {
        path: 'Education/Terms',
        component: AcademicTermsPage,
        canActivate: [moduleGuard('education'), permissionGuard('manage education')],
      },
      {
        path: 'Education/EnrollmentHistory',
        component: EnrollmentHistoryPage,
        canActivate: [moduleGuard('education'), permissionGuard('manage enrollments')],
      },
      {
        path: 'Education/Reports',
        component: EducationReportsPage,
        canActivate: [moduleGuard('education'), permissionGuard('view education reports')],
      },
    ],
  },
];
