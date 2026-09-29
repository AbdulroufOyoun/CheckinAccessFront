import { CanActivateFn, Router } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { TenantCustomizationService } from '../services/tenant-customization.service';
import { TenantModuleName } from '../model/User';
import { hasTenantHost } from '../core/tenant-host';

function browserOnly(): boolean {
  return isPlatformBrowser(inject(PLATFORM_ID));
}

/** Block tenant admin UI on bare localhost — require a tenant subdomain in the URL. */
export const tenantGuard: CanActivateFn = () => {
  if (!browserOnly()) {
    return true;
  }
  if (hasTenantHost()) {
    const auth = inject(AuthService);
    auth.ensureTenantHostBinding();
    return true;
  }
  return inject(Router).createUrlTree(['/TenantRequired']);
};

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  // During SSR/prerender, send protected routes to Login to avoid browser-only APIs.
  if (!browserOnly()) {
    return router.createUrlTree(['/Login']);
  }
  if (!hasTenantHost()) {
    return router.createUrlTree(['/TenantRequired']);
  }
  const auth = inject(AuthService);
  auth.ensureTenantHostBinding();
  if (auth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/Login']);
};

export const guestGuard: CanActivateFn = () => {
  if (!browserOnly()) {
    return true;
  }
  if (!hasTenantHost()) {
    return inject(Router).createUrlTree(['/TenantRequired']);
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  auth.ensureTenantHostBinding();
  if (!auth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree([auth.homeRoute()]);
};

export function moduleGuard(module: TenantModuleName): CanActivateFn {
  return moduleGuardAny(module);
}

export function moduleGuardAny(...modules: TenantModuleName[]): CanActivateFn {
  return () => {
    const router = inject(Router);
    if (!browserOnly()) {
      return router.createUrlTree(['/Login']);
    }
    const auth = inject(AuthService);
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/Login']);
    }
    if (modules.some((module) => auth.hasModule(module))) {
      return true;
    }
    return router.createUrlTree([auth.homeRoute()]);
  };
}

export const establishmentSetupGuard: CanActivateFn = async () => {
  const router = inject(Router);
  if (!browserOnly()) {
    return router.createUrlTree(['/Login']);
  }
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/Login']);
  }
  if (!auth.hasModule('property') || !auth.isSuperAdmin()) {
    return router.createUrlTree([auth.homeRoute()]);
  }
  const customization = inject(TenantCustomizationService);
  const settings = await customization.loadSettings();
  if (settings?.onboarding?.establishment_step_done === true) {
    return router.createUrlTree(['/PropertyOnboarding']);
  }
  if (settings?.onboarding?.completed === true) {
    return router.createUrlTree([auth.homeRoute()]);
  }
  return true;
};

export const propertyOnboardingGuard: CanActivateFn = async () => {
  const router = inject(Router);
  if (!browserOnly()) {
    return router.createUrlTree(['/Login']);
  }
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/Login']);
  }
  if (!auth.hasModule('property') || !auth.isSuperAdmin()) {
    return router.createUrlTree([auth.homeRoute()]);
  }
  const customization = inject(TenantCustomizationService);
  const settings = await customization.loadSettings();
  const onboarding = settings?.onboarding;
  if (onboarding?.completed === true) {
    return router.createUrlTree([auth.homeRoute()]);
  }
  if (onboarding?.establishment_step_done !== true) {
    return router.createUrlTree(['/EstablishmentSetup']);
  }
  return true;
};

export const establishmentOnboardingRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  if (!browserOnly()) {
    return router.createUrlTree(['/Login']);
  }
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/Login']);
  }
  const customization = inject(TenantCustomizationService);
  const settings = await customization.loadSettings();
  const modules = auth.getUser()?.modules ?? [];
  const route = customization.resolveOnboardingRoute(modules, auth.isSuperAdmin());
  if (route) {
    return router.createUrlTree([route]);
  }
  return true;
};

export function permissionGuard(...permissions: string[]): CanActivateFn {
  return () => {
    const router = inject(Router);
    if (!browserOnly()) {
      return router.createUrlTree(['/Login']);
    }
    const auth = inject(AuthService);
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/Login']);
    }
    if (auth.canAny(...permissions)) {
      return true;
    }
    return router.createUrlTree([auth.homeRoute()]);
  };
}
