export type BadgeTone = 'danger' | 'warning' | 'accent' | 'success' | 'neutral'

const TONE_STYLES: Record<BadgeTone, string> = {
  danger:  'bg-[rgba(255,59,48,0.10)] text-[var(--danger)]',
  warning: 'bg-[rgba(255,166,0,0.10)] text-[var(--warning)]',
  accent:  'bg-[var(--accent-f)] text-[var(--accent-h)]',
  success: 'bg-[var(--mod-habits-f)] text-[var(--success)]',
  neutral: 'bg-[var(--surface-2)] text-[var(--label-3)]',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--radius-xs)] shrink-0 ${TONE_STYLES[tone]}`}>
      {children}
    </span>
  )
}
