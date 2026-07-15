import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { easeOut } from '../../lib/motionPresets'

// Small DOM particle burst for celebratory moments (habit completions,
// streak milestones — the moments --energy is reserved for). Ten dots fly
// out radially and fade; the component unmounts itself afterwards. Renders
// nothing under reduced motion. Position it inside a `relative` parent,
// centered on the trigger point.
const COLORS = ['var(--energy)', 'var(--accent)', 'var(--success)']

export function CelebrationBurst({ onDone }: { onDone?: () => void }) {
  const reduced = useReducedMotion()
  const [gone, setGone] = useState(false)

  const dots = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.5
        const radius = 28 + Math.random() * 20
        return {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          color: COLORS[i % COLORS.length],
          delay: Math.random() * 0.06,
        }
      }),
    []
  )

  useEffect(() => {
    const id = setTimeout(() => {
      setGone(true)
      onDone?.()
    }, 620)
    return () => clearTimeout(id)
  }, [onDone])

  if (reduced || gone) return null

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: d.color }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: d.x, y: d.y, scale: 0, opacity: 0 }}
          transition={{ duration: 0.55, ease: easeOut, delay: d.delay }}
        />
      ))}
    </span>
  )
}
