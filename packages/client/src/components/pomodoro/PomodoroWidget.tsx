import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw, SkipForward, X, Timer } from 'lucide-react'
import { usePomodoroStore } from '../../stores/pomodoroStore'

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const frequencies = [587.33, 783.99]
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      const start = now + i * 0.2
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.3, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8)
      osc.start(start)
      osc.stop(start + 0.8)
    })
    setTimeout(() => ctx.close(), 2000)
  } catch {}
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function PomodoroWidget({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation()
  const {
    phase, timerState, timeLeft, sessionsCompleted, settings,
    expanded, toggleExpanded, setTimerState, setPhase, setTimeLeft,
    tick, incrementSessions, updateSettings, reset,
  } = usePomodoroStore()

  const isRunning = timerState === 'running'
  const [isExiting, setIsExiting] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPhaseRef = useRef(phase)
  const iconRef = useRef<HTMLSpanElement>(null)

  const handleClose = () => setIsExiting(true)

  const handleExitDone = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.animationName === 'widget-exit') {
      setIsExiting(false)
      toggleExpanded()
    }
  }

  const phaseColor = phase === 'focus' ? 'var(--accent)' : 'var(--success)'

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => tick(), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning])

  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      if (settings.soundEnabled) playChime()
      if (phase === 'focus') {
        const newCount = sessionsCompleted + 1
        incrementSessions()
        // Long break after every 4th focus session (standard Pomodoro technique)
        if (newCount % 4 === 0) {
          setPhase('longBreak')
          setTimeLeft(settings.longBreakMinutes * 60)
        } else {
          setPhase('shortBreak')
          setTimeLeft(settings.shortBreakMinutes * 60)
        }
      } else {
        // After any break, return to focus
        setPhase('focus')
        setTimeLeft(settings.focusMinutes * 60)
      }
      if (settings.autoStartNext) {
        setTimerState('running')
      } else {
        setTimerState('idle')
      }
    }
  }, [timeLeft])

  useEffect(() => {
    if (prevPhaseRef.current !== phase && settings.soundEnabled) playChime()
    prevPhaseRef.current = phase
  }, [phase])

  // Animate play/pause icon swap via WAAPI — blur dissolve between states
  useEffect(() => {
    if (!iconRef.current) return
    iconRef.current.animate(
      [
        { opacity: 0, filter: 'blur(3px)', transform: 'scale(0.82)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
      ],
      { duration: 140, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
    )
  }, [isRunning])

  const totalDuration = phase === 'focus'
    ? settings.focusMinutes * 60
    : phase === 'longBreak'
    ? settings.longBreakMinutes * 60
    : settings.shortBreakMinutes * 60
  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference * (1 - progress)
  const phaseLabel = phase === 'focus' ? t('pomodoro.focusLabel') : phase === 'longBreak' ? t('pomodoro.longBreakLabel') : t('pomodoro.breakLabel')

  const [minStr, secStr] = formatTime(timeLeft).split(':')

  const handleSkip = () => {
    if (phase === 'focus') {
      const newCount = sessionsCompleted + 1
      incrementSessions()
      if (newCount % 4 === 0) {
        setPhase('longBreak')
        setTimeLeft(settings.longBreakMinutes * 60)
      } else {
        setPhase('shortBreak')
        setTimeLeft(settings.shortBreakMinutes * 60)
      }
    } else {
      setPhase('focus')
      setTimeLeft(settings.focusMinutes * 60)
    }
    setTimerState('idle')
  }

  const handleToggle = () => {
    setTimerState(isRunning ? 'paused' : 'running')
  }

  if (!inline && !expanded && !isExiting) {
    if (timerState === 'idle' && sessionsCompleted === 0) {
      return (
        <button
          onClick={toggleExpanded}
          className="animate-widget-enter fixed bottom-6 right-6 z-50 p-3 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.10)] border border-[var(--sep)] bg-[var(--surface)] hover:scale-105 active:scale-[0.97] transition-[transform,background-color] duration-[160ms]"
          title={t('pomodoro.timerTitle')}
        >
          <Timer className="w-5 h-5 text-[var(--label-2)]" />
        </button>
      )
    }

    return (
      <button
        onClick={toggleExpanded}
        className="animate-widget-enter fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.10)] border border-[var(--sep)] bg-[var(--accent-f)] hover:scale-105 active:scale-[0.97] transition-[transform,background-color] duration-[160ms]"
      >
        <div className="relative w-2.5 h-2.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phaseColor }} />
          {isRunning && (
            <div
              className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: phaseColor, opacity: 0.4 }}
            />
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums" style={{ color: phaseColor }}>
          {formatTime(timeLeft)}
        </span>
      </button>
    )
  }

  return (
    <div
      className={inline ? '' : `fixed bottom-6 right-6 z-50 ${isExiting ? 'animate-widget-exit' : 'animate-widget-enter'}`}
      onAnimationEnd={inline ? undefined : handleExitDone}
    >
      <div className="bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] w-72 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sep)]">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full transition-colors duration-500"
              style={{ backgroundColor: phaseColor }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wider transition-colors duration-500"
              style={{ color: phaseColor }}
            >
              {phaseLabel}
            </span>
          </div>
          {!inline && (
            <button
              onClick={handleClose}
              className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--label-3)]" />
            </button>
          )}
        </div>

        {/* Timer display */}
        <div className="px-4 py-6">
          <div className="relative w-32 h-32 mx-auto mb-5">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" strokeWidth="6" style={{ stroke: 'var(--surface-3)' }} />
              <circle
                cx="60" cy="60" r="54" fill="none" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  stroke: phaseColor,
                  transition: 'stroke-dashoffset 1000ms linear, stroke 500ms ease-out',
                }}
              />
            </svg>
            {/* Dark digit panel while a session is running, per spec: timer
                digits live "inside a dark panel" only during active use, not
                as the app's default style — independent of Focus Mode. */}
            <div
              className={`absolute inset-[10px] rounded-full transition-colors duration-500 ${isRunning ? 'bg-[var(--label)]' : ''}`}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono flex items-baseline tabular-nums leading-none">
                <span
                  key={`m${minStr}`}
                  className={`text-2xl font-bold inline-block animate-digit-tick transition-colors duration-500 ${isRunning ? 'text-[var(--bg)]' : 'text-[var(--label)]'}`}
                >
                  {minStr}
                </span>
                <span className={`text-2xl font-bold opacity-40 mx-px transition-colors duration-500 ${isRunning ? 'text-[var(--bg)]' : 'text-[var(--label)]'}`}>:</span>
                <span
                  key={`s${secStr}`}
                  className={`text-2xl font-bold inline-block animate-digit-tick transition-colors duration-500 ${isRunning ? 'text-[var(--bg)]' : 'text-[var(--label)]'}`}
                >
                  {secStr}
                </span>
              </div>
              <span
                className="text-[10px] uppercase tracking-wider font-semibold mt-1 transition-colors duration-500"
                style={{ color: phaseColor }}
              >
                {phaseLabel}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={reset}
              className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
              title={t('pomodoro.reset')}
            >
              <RotateCcw className="w-4 h-4 text-[var(--label-2)]" />
            </button>
            <button
              onClick={handleToggle}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-[transform,background-color] duration-[160ms] hover:scale-[1.06] active:scale-[0.94]"
              style={{
                backgroundColor: phaseColor,
                transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              <span ref={iconRef} className="flex items-center justify-center">
                {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </span>
            </button>
            <button
              onClick={handleSkip}
              className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
              title={t('pomodoro.skip')}
            >
              <SkipForward className="w-4 h-4 text-[var(--label-2)]" />
            </button>
          </div>

          {/* Sessions counter */}
          <p className="text-xs text-center text-[var(--label-3)]">
            {t('pomodoro.sessions')}<span className="font-semibold text-[var(--label)]">{sessionsCompleted}</span>
          </p>

          {/* Settings */}
          <div className="mt-4 pt-4 border-t border-[var(--sep)] space-y-3">
            <div className="bg-[var(--surface-2)] rounded-[var(--radius-lg)] p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-[var(--label-3)]">{t('pomodoro.focusLabel')}</label>
                  <span className="text-xs font-semibold text-[var(--label)]">{settings.focusMinutes} {t('pomodoro.min')}</span>
                </div>
                <input
                  type="range" min="5" max="60" step="5"
                  value={settings.focusMinutes}
                  onChange={(e) => updateSettings({ focusMinutes: parseInt(e.target.value) })}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--accent)] bg-[var(--surface-3)]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-[var(--label-3)]">{t('pomodoro.breakLabel')}</label>
                  <span className="text-xs font-semibold text-[var(--label)]">{settings.shortBreakMinutes} {t('pomodoro.min')}</span>
                </div>
                <input
                  type="range" min="1" max="30" step="1"
                  value={settings.shortBreakMinutes}
                  onChange={(e) => updateSettings({ shortBreakMinutes: parseInt(e.target.value) })}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--success)] bg-[var(--surface-3)]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-[var(--label-3)]">{t('pomodoro.longBreakLabel')}</label>
                  <span className="text-xs font-semibold text-[var(--label)]">{settings.longBreakMinutes} {t('pomodoro.min')}</span>
                </div>
                <input
                  type="range" min="5" max="60" step="5"
                  value={settings.longBreakMinutes}
                  onChange={(e) => updateSettings({ longBreakMinutes: parseInt(e.target.value) })}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--success)] bg-[var(--surface-3)]"
                />
              </div>
            </div>

            <Toggle
              label={t('pomodoro.sound')}
              enabled={settings.soundEnabled}
              onToggle={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            />
            <Toggle
              label={t('pomodoro.autoStart')}
              enabled={settings.autoStartNext}
              onToggle={() => updateSettings({ autoStartNext: !settings.autoStartNext })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--label-3)]">{label}</span>
      <button
        onClick={onToggle}
        className={`w-9 h-5 rounded-full transition-colors relative ${
          enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'
        }`}
      >
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform duration-[160ms] [transition-timing-function:var(--ease-out)] ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  )
}
