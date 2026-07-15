import { useEffect, useRef } from 'react'

// Scroll-reveal hooks backed by the .landing-reveal-* / .landing-stagger-*
// classes in index.css. The init class is added from JS after mount so content
// stays visible when JS is absent (progressive enhancement), and reduced
// motion is honored by the CSS media block — these hooks don't need to check.

export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.2) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.add('landing-reveal-init')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('landing-reveal-in')
          io.disconnect()
        }
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

export function useStagger<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.add('landing-stagger-init')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('landing-stagger-in')
          io.disconnect()
        }
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
