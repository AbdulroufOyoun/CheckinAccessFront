import { Injectable, inject } from '@angular/core';
import { TenantCustomizationService } from './tenant-customization.service';
import { LocaleService, AppLang } from './locale.service';

@Injectable({ providedIn: 'root' })
export class TenantDateTimeService {
  private readonly customization = inject(TenantCustomizationService);
  private readonly locale = inject(LocaleService);

  formatDate(value?: string | null): string {
    if (!value || value === '—') {
      return '—';
    }
    const raw = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return value;
    }
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return this.formatWithIntl(date, { dateStyle: 'medium' });
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    const regional = this.customization.regionalSettings();
    return this.formatWithIntl(date, {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: regional?.hour12 ?? false,
    });
  }

  private formatWithIntl(
    date: Date,
    options: Intl.DateTimeFormatOptions,
  ): string {
    const lang = this.locale.lang();
    const regional = this.customization.regionalSettings();
    const locale = lang === 'ar' ? 'ar-SA' : 'en-GB';
    try {
      return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: regional?.timezone || undefined,
      }).format(date);
    } catch {
      return date.toISOString();
    }
  }
}
