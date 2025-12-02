import { getRequestConfig } from 'next-intl/server';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  type SupportedLocale,
  getTranslations,
  isValidLocale,
} from '@chaski/shared-i18n';

// Re-export for backward compatibility
export const locales = SUPPORTED_LOCALES;
export type Locale = SupportedLocale;
export const defaultLocale = DEFAULT_LOCALE;
export const localeNames = LOCALE_NAMES;

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !isValidLocale(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: getTranslations(locale as SupportedLocale),
  };
});
