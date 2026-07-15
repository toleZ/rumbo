import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Size = 'sm' | 'md'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  size?: Size
  className?: string
}

// Shared "nothing here" treatment — a violet line-icon in a soft tint circle
// instead of bare gray text, per the design pass: empty states should have a
// little personality without turning into full illustration. `sm` is for
// compact widget panels (Today's dashboard cards), `md` for full-page states
// (List, Habits, Notes, Calendar).
export function EmptyState({ icon: Icon, title, description, action, size = 'md', className = '' }: EmptyStateProps) {
  const iconWrap = size === 'sm' ? 'w-9 h-9' : 'w-14 h-14'
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  const padding = size === 'sm' ? 'py-6 px-4' : 'py-14 px-6'
  const gap = size === 'sm' ? 'gap-2' : 'gap-3'
  const titleSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className={`flex flex-col items-center justify-center text-center ${gap} ${padding} ${className}`}>
      <div className={`${iconWrap} rounded-full bg-[var(--accent-f)] flex items-center justify-center shrink-0 animate-float`}>
        <Icon className={`${iconSize} text-[var(--accent)]`} strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className={`${titleSize} font-medium text-[var(--label-2)]`}>{title}</p>
        {description && <p className="text-xs text-[var(--label-3)] max-w-[220px]">{description}</p>}
      </div>
      {action}
    </div>
  )
}
