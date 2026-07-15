import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'
import { easeOutExpo } from '../../lib/motionPresets'

// Count-up number that starts when scrolled into view (once). Writes frames
// straight into the DOM node — no React re-render per tick. Reduced motion
// (or a 0 target) renders the final value immediately.
export function AnimatedNumber({
  value,
  suffix = '',
  className = '',
}: {
  value: number
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduced || value === 0) {
      el.textContent = `${value}${suffix}`
      return
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: easeOutExpo,
      onUpdate: (v) => {
        el.textContent = `${Math.round(v)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, value, suffix, reduced])

  return (
    <span ref={ref} className={className}>
      {`0${suffix}`}
    </span>
  )
}
