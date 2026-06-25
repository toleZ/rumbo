import { CloudRain, Waves, Moon, Play, Pause, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAmbientStore, type SoundType } from '../../../stores/ambientStore'

const SOUNDS: { id: SoundType; icon: React.ElementType; labelKey: string; fallback: string }[] = [
  { id: 'rain',  icon: CloudRain, labelKey: 'ring.ambientRain',  fallback: 'Rain' },
  { id: 'ocean', icon: Waves,     labelKey: 'ring.ambientOcean', fallback: 'Ocean' },
  { id: 'night', icon: Moon,      labelKey: 'ring.ambientNight', fallback: 'Night' },
]

function SoundBars() {
  return (
    <span className="flex items-end gap-px h-3 shrink-0" aria-hidden>
      {[0, 80, 160].map((delay) => (
        <span
          key={delay}
          className="w-0.5 rounded-full animate-sound-bar"
          style={{
            height: '12px',
            background: 'var(--accent)',
            animationDelay: `${delay}ms`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </span>
  )
}

export function AmbientWidget() {
  const { t } = useTranslation()
  const { isPlaying, sound, volume, setPlaying, setSound, setVolume } = useAmbientStore()

  const handleSoundClick = (id: SoundType) => {
    setSound(id)
    // Preserve current play state — the ▶/⏸ button is the sole play trigger.
    // Calling setPlaying(true) here would resume a deliberate pause when switching sounds.
  }

  return (
    <div className="bg-[var(--surface)] rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[var(--sep)] w-72 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--sep)]">
        <Waves className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          {t('ring.ambient', 'Ambient')}
        </span>
      </div>

      {/* Sound list */}
      <div className="p-2">
        {SOUNDS.map(({ id, icon: Icon, labelKey, fallback }) => {
          const isActive = sound === id && isPlaying
          const isSelected = sound === id
          return (
            <button
              key={id}
              onClick={() => handleSoundClick(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors duration-[120ms] text-left"
              style={{
                background: isActive
                  ? 'var(--accent-f)'
                  : isSelected && !isPlaying
                  ? 'var(--surface-2)'
                  : undefined,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = isActive
                  ? 'var(--accent-f)'
                  : isSelected && !isPlaying
                  ? 'var(--surface-2)'
                  : ''
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: isActive ? 'var(--accent)' : 'var(--label-2)' }}
              />
              <span
                className="text-sm flex-1"
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--label)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {t(labelKey, fallback)}
              </span>
              {isActive && <SoundBars />}
            </button>
          )
        })}
      </div>

      {/* Volume + play/pause */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--sep)]">
        <Volume2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--label-3)' }} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="ambient-slider flex-1"
          style={{ '--fill': `${Math.round(volume * 100)}%` } as React.CSSProperties}
          aria-label={t('ring.ambientVolume', 'Volume')}
        />
        <button
          onClick={() => setPlaying(!isPlaying)}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-[background-color,transform] duration-[140ms] hover:scale-105 active:scale-95"
          style={{
            background: isPlaying ? 'var(--accent)' : 'var(--surface-3)',
          }}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5" style={{ color: '#fff' }} />
          ) : (
            <Play className="w-3.5 h-3.5" style={{ color: 'var(--label-2)', marginLeft: '1px' }} />
          )}
        </button>
      </div>
    </div>
  )
}
