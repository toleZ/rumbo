import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore } from '../../stores/uiStore'
import i18n from '../../lib/i18n'

export function LanguageToggle() {
  const { language, setLanguage } = useUIStore(useShallow(s => ({ language: s.language, setLanguage: s.setLanguage })))
  const { t } = useTranslation()

  const toggle = () => {
    const next = language === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
    setLanguage(next)
  }

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 rounded-[6px] text-xs font-semibold text-[var(--label-2)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97] tracking-wide"
      title={t('sidebar.language')}
      aria-label={t('sidebar.language')}
    >
      {language.toUpperCase()}
    </button>
  )
}
