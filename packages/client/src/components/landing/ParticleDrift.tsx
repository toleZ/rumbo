import { useEffect, useRef } from 'react'
import { useLazyFx } from '../../hooks/useLazyFx'

// Sparse field of tiny white dots drifting up-right with a gentle sine sway,
// wrapping at the edges. One draw loop for all particles (~70 arcs at 30fps),
// same lazy-mount / off-screen-pause discipline as AuroraCanvas. Purely
// decorative: skipped entirely under reduced motion.

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  phase: number
}

const FRAME_MS = 33

export function ParticleDrift({ count = 70, className = '' }: { count?: number; className?: string }) {
  const { ref, active, visible } = useLazyFx<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  useEffect(() => {
    if (!active) return
    const host = ref.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles: Particle[] = []
    const seed = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 4 + Math.random() * 6,   // px/s, rightward
        vy: 4 + Math.random() * 6,   // px/s, upward
        size: 1 + Math.random(),
        alpha: 0.15 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      canvas.width = Math.max(2, host.clientWidth)
      canvas.height = Math.max(2, host.clientHeight)
      seed()
    }

    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden || !visibleRef.current) return
      if (t - last < FRAME_MS) return
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t

      const w = canvas.width
      const h = canvas.height
      const time = t / 1000
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      for (const p of particles) {
        p.x += p.vx * dt + Math.sin(time * 0.8 + p.phase) * 0.12
        p.y -= p.vy * dt
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w }
        if (p.x > w + 4) p.x = -4
        ctx.globalAlpha = p.alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [active, count, ref])

  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      {active && <canvas ref={canvasRef} className="w-full h-full" />}
    </div>
  )
}
