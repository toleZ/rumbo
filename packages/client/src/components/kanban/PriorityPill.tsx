import { useTranslation } from 'react-i18next'

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-[rgba(255,59,48,0.10)] text-[var(--danger)]',
  high:   'bg-[rgba(255,149,0,0.10)] text-[var(--warning)]',
  medium: 'bg-[var(--accent-f)] text-[var(--accent)]',
  low:    'bg-[var(--surface-2)] text-[var(--label-3)]',
}

export function PriorityPill({ priority }: { priority?: string | null }) {
  const { t } = useTranslation()
  const cls = PRIORITY_STYLES[priority ?? 'low'] ?? PRIORITY_STYLES.low
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] shrink-0 ${cls}`}>
      {t(`priority.${priority ?? 'low'}`)}
    </span>
  )
}
