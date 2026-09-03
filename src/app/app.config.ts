import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';

import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { authInterceptor } from './interceptors/auth.interceptor';
import { apiErrorInterceptor } from './interceptors/api-error.interceptor';
import { StaticTranslateLoader } from './i18n/static-translate.loader';
import { LocaleService } from './services/locale.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimations(),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        autoFocus: false,
        restoreFocus: false,
        enterAnimationDuration: '0ms',
        exitAnimationDuration: '120ms',
        panelClass: 'custom-dialog',
        backdropClass: 'custom-backdrop',
      },
    },
    provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
    provideTranslateService({
      loader: provideTranslateLoader(StaticTranslateLoader),
      fallbackLang: 'en',
      lang: 'en',
    }),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const locale = inject(LocaleService);
        return () => locale.init();
      },
    },
  ],
};
