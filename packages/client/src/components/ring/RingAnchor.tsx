import { LayoutGrid } from 'lucide-react'
import { usePomodoroStore } from '../../stores/pomodoroStore'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function RingAnchor({ onMouseEnter }: { onMouseEnter?: () => void }) {
  const { timerState, timeLeft, phase } = usePomodoroStore()
  const isRunning = timerState === 'running'
  const phaseColor = phase === 'focus' ? 'var(--accent)' : 'var(--success)'

  return (
    <div
      onMouseEnter={onMouseEnter}
      className="relative w-11 h-11 rounded-full flex items-center justify-center bg-[var(--surface)] border border-[var(--sep)] shadow-[0_4px_12px_rgba(0,0,0,0.10)] transition-[transform,background-color] duration-[160ms] hover:scale-105 active:scale-[0.97] cursor-pointer select-none"
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
    </div>
  )
}
