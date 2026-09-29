import en from '../../assets/i18n/en.json';
import ar from '../../assets/i18n/ar.json';
import type { AppLang } from '../services/locale.service';

const BUNDLES: Record<AppLang, Record<string, string>> = {
  en: en as Record<string, string>,
  ar: ar as Record<string, string>,
};

/** Synchronous copy lookup for onboarding (zoneless + language picker preview). */
export function onboardingI18n(lang: AppLang, key: string): string {
  return BUNDLES[lang][key] ?? BUNDLES.en[key] ?? key;
}
