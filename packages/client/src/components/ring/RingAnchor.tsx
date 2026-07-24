import { LayoutGrid } from 'lucide-react'
import { usePomodoroStore } from '../../stores/pomodoroStore'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

interface RingAnchorProps {
  onMouseEnter?: () => void
  onClick?: () => void
  expanded?: boolean
  label: string
}

export function RingAnchor({ onMouseEnter, onClick, expanded, label }: RingAnchorProps) {
  const { timerState, timeLeft, phase } = usePomodoroStore()
  const isRunning = timerState === 'running'
  const phaseColor = phase === 'focus' ? 'var(--accent)' : 'var(--success)'

  return (
    // A real <button>, not a div with cursor-pointer: this is the entry point
    // to four features, and it previously had no keyboard or tap path at all.
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={label}
      className="relative w-11 h-11 rounded-full flex items-center justify-center bg-[var(--surface)] border border-[var(--sep)] shadow-[var(--shadow-lg)] transition-[transform,background-color] duration-[160ms] hover:scale-105 active:scale-[0.97] cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <LayoutGrid className="w-5 h-5 text-[var(--label-2)]" />

      {isRunning && (
        <span
          className="absolute -top-1 -right-1 text-[9px] font-bold tabular-nums px-1 py-px rounded-full leading-none"
          style={{ background: phaseColor, color: '#fff' }}
        >
          {formatTime(timeLeft)}
        </span>
      )}

      {timerState !== 'idle' && !isRunning && (
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg)]"
          style={{ background: phaseColor }}
        />
      )}
    </button>
  )
}
