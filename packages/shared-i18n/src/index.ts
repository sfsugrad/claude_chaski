// Shared i18n package

// Supported locales
export const SUPPORTED_LOCALES = ['en', 'fr', 'es'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'

// Locale names for display
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
}

// Locale codes for display (short form)
export const LOCALE_CODES: Record<SupportedLocale, string> = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
}

// Check if a string is a valid locale
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

// Get locale from string or return default
export function getLocale(locale: string | undefined | null): SupportedLocale {
  if (locale && isValidLocale(locale)) {
    return locale
  }
  return DEFAULT_LOCALE
}

// Import all translations (for bundling all at once)
import en from './locales/en.json'
import fr from './locales/fr.json'
import es from './locales/es.json'

export const translations = {
  en,
  fr,
  es,
} as const

// Get translations for a specific locale
export function getTranslations(locale: SupportedLocale) {
  return translations[locale]
}

// Type for translation messages (based on English)
export type Messages = typeof en
