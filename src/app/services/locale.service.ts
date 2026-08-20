import { ApplicationRef, Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, of, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type AppLang = 'en' | 'ar';

const STORAGE_KEY = 'lang';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly translate = inject(TranslateService);
  private readonly appRef = inject(ApplicationRef);
  private readonly langSignal = signal<AppLang>('en');

  readonly lang = this.langSignal.asReadonly();

  async init(): Promise<void> {
    this.translate.addLangs(['en', 'ar']);
    const initial = this.resolveInitial();
    await this.use(initial, false);
  }

  async use(lang: AppLang, persist = true): Promise<void> {
    try {
      await firstValueFrom(
        this.translate.use(lang).pipe(
          timeout({ first: 1200 }),
          catchError(() => of(undefined)),
        ),
      );
    } catch {
      lang = 'en';
      await firstValueFrom(
        this.translate.use('en').pipe(
          timeout({ first: 800 }),
          catchError(() => of(undefined)),
        ),
      );
    }
    this.langSignal.set(lang);
    this.applyDocument(lang);
    this.appRef.tick();
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* ignore */
      }
    }
  }

  toggle(): Promise<void> {
    return this.use(this.langSignal() === 'ar' ? 'en' : 'ar');
  }

  private resolveInitial(): AppLang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {
      /* ignore */
    }
    const nav = (navigator.language || 'en').toLowerCase();
    return nav.startsWith('ar') ? 'ar' : 'en';
  }

  private applyDocument(lang: AppLang): void {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
}
