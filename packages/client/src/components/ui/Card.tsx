import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

// Default radius/shadow follow the design spec's "cards should feel light,
// depth suggested not asserted" guidance — 16px radius, a soft low-contrast
// shadow, rather than the tighter 10-12px + harder shadow used elsewhere for
// smaller interactive surfaces (buttons, chips).
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[var(--surface)] rounded-[var(--radius-2xl)] border border-[var(--sep)] shadow-[var(--shadow-sm)] overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  icon: ReactNode
  title: string
  meta?: ReactNode
}

Card.Header = function CardHeader({ icon, title, meta }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sep)]">
      <h3 className="text-sm font-semibold text-[var(--label)] flex items-center gap-2">{icon}{title}</h3>
      {meta !== undefined && <span className="text-xs text-[var(--label-3)] shrink-0 ml-3">{meta}</span>}
    </div>
  )
}
