import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motionPresets'

// Hydration gate for decorative canvas/rAF effects. The effect mounts only
// once its host element has entered the viewport AND the main thread went
// idle — so first paint is never taxed by eye candy — and never under
// reduced motion. `visible` keeps reporting viewport state after activation
// so running loops can pause when scrolled away.
export function useLazyFx<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [active, setActive] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    let idleId: number | null = null
    let activated = false

    const io = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting && !activated) {
        activated = true
        // requestIdleCallback is missing in Safari — fall back to a short delay
        const ric = window.requestIdleCallback?.bind(window)
        idleId = ric
          ? ric(() => setActive(true), { timeout: 800 })
          : window.setTimeout(() => setActive(true), 200)
      }
    })
    io.observe(el)

    return () => {
      io.disconnect()
      if (idleId !== null) {
        const cic = window.cancelIdleCallback?.bind(window)
        if (cic) cic(idleId)
        else window.clearTimeout(idleId)
      }
    }
  }, [])

  return { ref, active, visible }
}
