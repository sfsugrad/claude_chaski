// Mock for i18n/request.ts

export const locales = ['en', 'fr', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale = 'en'
export const localeNames = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
}

// Default export is the config function result
export default async function mockRequestConfig() {
  return {
    locale: 'en',
    messages: {},
  }
}
