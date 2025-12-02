import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import {
  translations,
  DEFAULT_LOCALE,
  isValidLocale,
  type SupportedLocale,
} from '@chaski/shared-i18n'

// Get device locale and validate it
const deviceLocale = Localization.getLocales()[0]?.languageCode || DEFAULT_LOCALE
const initialLocale: SupportedLocale = isValidLocale(deviceLocale)
  ? deviceLocale
  : DEFAULT_LOCALE

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: translations.en },
    fr: { translation: translations.fr },
    es: { translation: translations.es },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false, // React Native handles this
  },
  compatibilityJSON: 'v4', // Required for React Native
})

export default i18n
