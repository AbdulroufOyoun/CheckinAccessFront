import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SnackbarService } from '../services/snackbar.service';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(SnackbarService);

  return next(req).pipe(
    catchError((error: unknown) => {
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
