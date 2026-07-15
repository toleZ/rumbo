import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useSpring } from 'motion/react'

// Wraps a CTA and pulls it a few pixels toward the cursor while hovered,
// springing back on leave — same spring feel as the ActionRing widgets.
// Mouse-only ((pointer: fine)) and skipped under reduced motion; in both
// cases it degrades to a plain wrapper and the child's own hover style.
export function MagneticButton({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const [finePointer, setFinePointer] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const x = useSpring(0, { stiffness: 480, damping: 32 })
  const y = useSpring(0, { stiffness: 480, damping: 32 })

  useEffect(() => {
    setFinePointer(window.matchMedia('(pointer: fine)').matches)
  }, [])

  if (reduced || !finePointer) {
    return <div className={`inline-block ${className}`}>{children}</div>
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const dist = Math.hypot(dx, dy) || 1
    const pull = Math.min(dist * 0.25, 6)
    x.set((dx / dist) * pull)
    y.set((dy / dist) * pull)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x, y }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  )
}
