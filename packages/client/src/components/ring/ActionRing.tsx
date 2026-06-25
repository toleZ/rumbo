import { useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useActionRingStore, type WidgetType } from '../../stores/actionRingStore'
import { RingAnchor } from './RingAnchor'
import { WidgetCircle } from './WidgetCircle'
import { PomodoroRingWidget } from './widgets/PomodoroRingWidget'
import { AIAssistantWidget } from './widgets/AIAssistantWidget'

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
          {type === 'ai-assistant' && <AIAssistantWidget />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ActionRing() {
  const { isExpanded, activeWidget, widgets, setExpanded, setActiveWidget } = useActionRingStore()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleAnchorEnter = () => {
    cancelClose()
    setExpanded(true)
  }

  const handleCircleEnter = (id: string) => {
    cancelClose()
    setActiveWidget(id)
  }

  const handleMouseLeave = () => {
    scheduleClose()
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-row-reverse items-end"
      onMouseLeave={handleMouseLeave}
    >
      <RingAnchor onMouseEnter={handleAnchorEnter} />

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
          />
        </div>
      ))}
    </div>
  )
}
