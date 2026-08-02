import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { AppShell } from './layout/app-shell/app-shell';
import { ReservationsPageComponent } from './layout/reservations-page-component/reservations-page-component';
import { OtpVerification } from './auth/otp-verification/otp-verification';
import { Login } from './auth/login/login';
import { Users } from './users/users';
import { Reports } from './reports/reports';
import { FacilitiesManagement } from './facilities-management/facilities-management';

export const routes: Routes = [
  { path: '', redirectTo: 'Login', pathMatch: 'full' },

  { path: 'Login', component: Login },

  { path: 'OtpVerification', component: OtpVerification },

  // Main App Layout
  {
    path: '',
    component: AppShell,
    children: [
      { path: 'Dashboard', component: Dashboard },

      { path: 'Reservations', component: ReservationsPageComponent },

      { path: 'Users', component: Users },

      { path: 'Reports', component: Reports },

      { path: 'FacilitiesManagement', component: FacilitiesManagement },

    ]
  }
];
