import { CanActivateFn, Router } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { TenantModuleName } from '../model/User';

function browserOnly(): boolean {
  return isPlatformBrowser(inject(PLATFORM_ID));
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  // During SSR/prerender, send protected routes to Login to avoid browser-only APIs.
  if (!browserOnly()) {
    return router.createUrlTree(['/Login']);
  }
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/Login']);
};

export const guestGuard: CanActivateFn = () => {
  if (!browserOnly()) {
    return true;
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree([auth.homeRoute()]);
};

export function moduleGuard(module: TenantModuleName): CanActivateFn {
  return () => {
    const router = inject(Router);
    if (!browserOnly()) {
      return router.createUrlTree(['/Login']);
    }
    const auth = inject(AuthService);
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/Login']);
    }
    if (auth.hasModule(module)) {
      return true;
    }
    return router.createUrlTree([auth.homeRoute()]);
  };
}

export function permissionGuard(permission: string): CanActivateFn {
  return () => {
    const router = inject(Router);
    if (!browserOnly()) {
      return router.createUrlTree(['/Login']);
    }
    const auth = inject(AuthService);
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/Login']);
    }
    if (auth.can(permission)) {
      return true;
    }
    return router.createUrlTree([auth.homeRoute()]);
  };
}
