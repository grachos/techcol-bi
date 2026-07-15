import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { es } from './locales/es'

export const LANGUAGE_STORAGE_KEY = 'app-language'

export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

const stored =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem(LANGUAGE_STORAGE_KEY)
    : null

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    // 'en' no necesita recursos: las claves ya son el texto en inglés
  },
  // Español por defecto
  lng: stored ?? 'es',
  fallbackLng: 'en',
  // Claves en lenguaje natural: desactivar separadores de i18next
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  document.documentElement.lang = lng
})

document.documentElement.lang = i18n.language

export default i18n
