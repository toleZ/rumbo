import { Timer, Sparkles, Waves, Music2 } from 'lucide-react'
import type { WidgetType } from '../../stores/actionRingStore'

const WIDGET_ICONS: Record<WidgetType, React.ElementType> = {
  pomodoro: Timer,
  ambient: Waves,
  spotify: Music2,
  'ai-assistant': Sparkles,
}

interface WidgetCircleProps {
  type: WidgetType
  isVisible: boolean
  isActive: boolean
  index: number
  onMouseEnter: () => void
  onClick: () => void
  label: string
}

export function WidgetCircle({ type, isVisible, isActive, index, onMouseEnter, onClick, label }: WidgetCircleProps) {
  const Icon = WIDGET_ICONS[type]
  const delay = isVisible ? `${index * 40}ms` : '0ms'

  return (
    <div
      style={{
        overflow: 'hidden',
        maxWidth: isVisible ? '52px' : '0px',
        opacity: isVisible ? 1 : 0,
        transition: isVisible
          ? `max-width 220ms var(--ease-drawer) ${delay}, opacity 180ms var(--ease-out) ${delay}`
          : 'max-width 160ms var(--ease-out), opacity 120ms var(--ease-out)',
        paddingTop: '4px',
        paddingBottom: '4px',
        marginTop: '-4px',
        marginBottom: '-4px',
      }}
    >
      <div style={{ paddingLeft: '4px', paddingRight: '8px' }} onMouseEnter={onMouseEnter}>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={isActive}
          aria-label={label}
          // tabIndex -1 while collapsed: the circle is visually hidden by a
          // maxWidth:0 clip rather than unmounted, so without this it stays in
          // the tab order as an invisible target.
          tabIndex={isVisible ? 0 : -1}
          className="w-10 h-10 rounded-full flex items-center justify-center border transition-[background-color,border-color,transform] duration-[140ms] hover:scale-105 active:scale-[0.97] cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{
            background: isActive
              ? (type === 'ai-assistant' ? 'var(--mod-ai-gradient)' : 'var(--accent)')
              : 'var(--surface)',
            borderColor: isActive ? 'var(--accent)' : 'var(--sep)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: isActive ? '#fff' : 'var(--label-2)' }}
          />
        </button>
      </div>
    </div>
  )
}
