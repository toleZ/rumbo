import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from '../locales/es.json'
import en from '../locales/en.json'

// Detect stored language, then browser preference, then fall back to Spanish
function detectLanguage(): 'es' | 'en' {
  const stored = localStorage.getItem('language')
  if (stored === 'es' || stored === 'en') return stored
  const browser = navigator.language?.slice(0, 2).toLowerCase()
  if (browser === 'en') return 'en'
  return 'es'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: detectLanguage(),
    fallbackLng: 'es',
    interpolation: {
      // React already escapes values
      escapeValue: false,
    },
  })

export default i18n
