import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useIsCoarsePointer } from '../../hooks/useMediaQuery'
import { useActionRingStore, type WidgetType } from '../../stores/actionRingStore'
import { useAmbientStore } from '../../stores/ambientStore'
import { ambientAudio } from '../../lib/ambientAudio'
import { RingAnchor } from './RingAnchor'
import { WidgetCircle } from './WidgetCircle'
import { PomodoroRingWidget } from './widgets/PomodoroRingWidget'
import { AIAssistantWidget } from './widgets/AIAssistantWidget'
import { AmbientWidget } from './widgets/AmbientWidget'
import { SpotifyWidget } from './widgets/SpotifyWidget'
import { SpotifyPlaybackHost } from './SpotifyPlaybackHost'

function AmbientPlayer() {
  const { isPlaying, sound, volume, setPlaying } = useAmbientStore()
  useEffect(() => {
    if (isPlaying) {
      ambientAudio.play(sound, volume).catch(() => setPlaying(false))
    } else {
      ambientAudio.stop()
    }
    return () => ambientAudio.stop()
  }, [isPlaying, sound])
  useEffect(() => {
    if (isPlaying) ambientAudio.setVolume(volume)
  }, [volume, isPlaying])
  return null
}

function WidgetCard({ type, isVisible }: { type: WidgetType; isVisible: boolean }) {
  const reduced = useReducedMotion()

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }
          }
          style={{
            transformOrigin: 'bottom right',
            paddingRight: '8px',
            paddingBottom: '8px',
          }}
        >
          {type === 'pomodoro' && <PomodoroRingWidget />}
          {type === 'ambient' && <AmbientWidget />}
          {type === 'spotify' && <SpotifyWidget />}
          {type === 'ai-assistant' && <AIAssistantWidget />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const WIDGET_LABEL_KEYS: Record<WidgetType, string> = {
  pomodoro: 'ring.pomodoro',
  ambient: 'ring.ambient',
  spotify: 'ring.spotify',
  'ai-assistant': 'ring.aiAssistant',
}

export function ActionRing() {
  const { t } = useTranslation()
  const { isExpanded, activeWidget, widgets, setExpanded, setActiveWidget } = useActionRingStore()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The ring was hover-driven end to end, which left Pomodoro, Ambient,
  // Spotify and the AI assistant with no way in on a touch device. Touch gets
  // an explicit tap-to-toggle model instead; the desktop hover flow is
  // untouched.
  const isTouch = useIsCoarsePointer()

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setExpanded(false)
      setActiveWidget(null)
    }, 300)
  }

  useEffect(() => cancelClose, [])

  const handleAnchorEnter = () => {
    if (isTouch) return
    cancelClose()
    setExpanded(true)
  }

  const handleCircleEnter = (id: string) => {
    if (isTouch) return
    cancelClose()
    setActiveWidget(id)
  }

  // On touch, a stray emulated mouseleave would close the ring mid-interaction.
  const handleMouseLeave = () => {
    if (isTouch) return
    scheduleClose()
  }

  const handleAnchorClick = () => {
    cancelClose()
    if (isExpanded) {
      setExpanded(false)
      setActiveWidget(null)
    } else {
      setExpanded(true)
    }
  }

  const handleCircleClick = (id: string) => {
    cancelClose()
    // Tapping the open widget's circle closes it — without this the only way
    // to dismiss a card on touch would be the outside-tap catcher.
    setActiveWidget(activeWidget === id ? null : id)
  }

  const close = () => {
    setExpanded(false)
    setActiveWidget(null)
  }

  return (
    <>
      {/* Tap-outside catcher. Touch only: on desktop the mouseleave timer
          already handles dismissal, and an invisible full-screen layer would
          swallow clicks meant for the page underneath. */}
      {isTouch && isExpanded && (
        <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
      )}

      <div
        className="fixed z-50 flex flex-row-reverse items-end"
        style={{
          bottom: 'calc(1.5rem + var(--safe-b))',
          right: 'calc(1.5rem + var(--safe-r))',
        }}
        onMouseLeave={handleMouseLeave}
      >
        <AmbientPlayer />
        <SpotifyPlaybackHost />
        <RingAnchor
          onMouseEnter={handleAnchorEnter}
          onClick={handleAnchorClick}
          expanded={isExpanded}
          label={t('ring.toggleRing')}
        />

        {widgets.map((widget, index) => (
          <div key={widget.id} className="relative" style={{ flexShrink: 0 }}>
            {/* Popup anchored above its own button */}
            <div
              className="absolute right-0"
              style={{ bottom: '100%' }}
              onMouseEnter={cancelClose}
              onMouseLeave={handleMouseLeave}
            >
              <WidgetCard
                type={widget.type}
                isVisible={activeWidget === widget.id}
              />
            </div>

            <WidgetCircle
              type={widget.type}
              isVisible={isExpanded}
              isActive={activeWidget === widget.id}
              index={index}
              onMouseEnter={() => handleCircleEnter(widget.id)}
              onClick={() => handleCircleClick(widget.id)}
              label={t(WIDGET_LABEL_KEYS[widget.type])}
            />
          </div>
        ))}
      </div>
    </>
  )
}
