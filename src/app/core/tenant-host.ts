const BARE_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Browser hostname used for tenant admin API calls, or null when no tenant is selected. */
export function resolveTenantApiHostname(): string | null {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return null;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  if (!hostname || BARE_DEV_HOSTS.has(hostname)) {
    return null;
  }

  const localSlug = hostname.match(/^([a-z0-9-]+)\.localhost$/i)?.[1];
  if (localSlug) {
    return localSlug === 'www' ? null : hostname;
  }

  const testSlug = hostname.match(/^([a-z0-9-]+)\.test$/i)?.[1];
  if (testSlug) {
    return testSlug === 'www' ? null : hostname;
  }

  // Custom tenant domain in production (e.g. ratco.example.com).
  return hostname;
}

export function hasTenantHost(): boolean {
  return resolveTenantApiHostname() != null;
}

export function currentTenantHost(): string | null {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return null;
  }
  return window.location.hostname.trim().toLowerCase();
}

export function tenantHostExample(slug = 'abd'): string {
  if (typeof window === 'undefined') {
    return `http://${slug}.localhost:4200`;
  }
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${slug}.localhost${port}`;
}
