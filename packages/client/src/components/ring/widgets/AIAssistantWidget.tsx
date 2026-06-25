import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function AIAssistantWidget() {
  const { t } = useTranslation()

  return (
    <div className="bg-[var(--surface)] rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[var(--sep)] w-72 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--sep)]">
        <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          {t('ring.aiAssistant', 'AI Assistant')}
        </span>
      </div>
      <div className="px-4 py-8 flex flex-col items-center gap-3 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent-f)' }}
        >
          <Sparkles className="w-6 h-6" style={{ color: 'var(--accent)' }} />
        </div>
        <p className="text-sm font-medium text-[var(--label)]">
          {t('ring.aiComingSoon', 'Coming soon')}
        </p>
        <p className="text-xs text-[var(--label-3)] max-w-[200px]">
          {t('ring.aiDescription', 'Ask questions about your tasks, notes, and habits.')}
        </p>
      </div>
    </div>
  )
}
