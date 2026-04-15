import { uk } from './uk.js';
import { ru } from './ru.js';

export type Locale = typeof uk;
export type LangCode = 'uk' | 'ru';

// Cast is needed because `as const` in each locale file produces literal types
// that differ between uk and ru; shape is identical, values are what matter.
const locales: Record<LangCode, Locale> = { uk, ru: ru as unknown as Locale };

export function getLocale(lang: string | null | undefined): Locale {
  if (lang && lang in locales) return locales[lang as LangCode];
  return uk;
}

export function isSupportedLang(lang: string): lang is LangCode {
  return lang in locales;
}

export { uk, ru };
