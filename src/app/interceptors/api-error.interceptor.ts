import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SnackbarService } from '../services/snackbar.service';
import { AuthService } from '../services/auth.service';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(SnackbarService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        const url = req.url.toLowerCase();
        const isPublicAuth =
          url.includes('/login') ||
          url.includes('/verify') ||
          url.includes('/tenant/public-config');
        if (!isPublicAuth && auth.getToken()) {
          auth.logout();
        }
      }

      const message =
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : '';
      if (SnackbarService.isTenantInactive(message)) {
        snackbar.show(message, 'warning');
      }
      return throwError(() => error);
    }),
  );
};
