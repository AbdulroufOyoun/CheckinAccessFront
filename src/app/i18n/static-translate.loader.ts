import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import en from '../../assets/i18n/en.json';
import ar from '../../assets/i18n/ar.json';

const TABLE: Record<string, TranslationObject> = {
  en: en as TranslationObject,
  ar: ar as TranslationObject,
};

@Injectable()
export class StaticTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(TABLE[lang] ?? TABLE['en']);
  }
}
