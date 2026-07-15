import { useEffect, useRef } from 'react'
import { useLazyFx } from '../../hooks/useLazyFx'

// Animated mesh-gradient wash — five soft radial blobs drifting on
// independent sine orbits. Drawn on a 1/6-scale buffer upscaled with a CSS
// blur so a frame costs well under a millisecond; capped at ~30fps and
// paused whenever the tab is hidden or the host scrolls off screen.
// Under reduced motion the canvas never mounts — the static gradient the
// host section already paints is the fallback.

interface AuroraBlob {
  color: [number, number, number]
  alpha: number
  cx: number
  cy: number
  ox: number
  oy: number
  px: number
  py: number
  period: number
  r: number
}

const SCALE = 6
const FRAME_MS = 33

export function AuroraCanvas({ intensity = 1, className = '' }: { intensity?: number; className?: string }) {
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

    // 1×1 probe canvas: paints any CSS color (incl. oklch tokens) and reads
    // the pixel back — robust color parsing without string format guesses.
    const probe = document.createElement('canvas')
    probe.width = probe.height = 1
    const pctx = probe.getContext('2d', { willReadFrequently: true })
    const toRgb = (c: string): [number, number, number] => {
      if (!pctx) return [255, 255, 255]
      pctx.clearRect(0, 0, 1, 1)
      pctx.fillStyle = c
      pctx.fillRect(0, 0, 1, 1)
      const d = pctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2]]
    }

    let blobs: AuroraBlob[] = []
    const buildBlobs = () => {
      const cs = getComputedStyle(document.documentElement)
      const white: [number, number, number] = [255, 255, 255]
      const sync = toRgb(cs.getPropertyValue('--sync').trim() || '#086FFF')
      const energy = toRgb(cs.getPropertyValue('--energy').trim() || '#E0489B')
      blobs = [
        { color: white, alpha: 0.12, cx: 0.25, cy: 0.35, ox: 0.18, oy: 0.14, px: 0.0, py: 1.7, period: 13, r: 0.45 },
        { color: white, alpha: 0.07, cx: 0.70, cy: 0.25, ox: 0.16, oy: 0.12, px: 2.1, py: 0.4, period: 17, r: 0.50 },
        { color: sync,  alpha: 0.08, cx: 0.55, cy: 0.70, ox: 0.20, oy: 0.16, px: 4.0, py: 2.6, period: 21, r: 0.55 },
        { color: energy, alpha: 0.06, cx: 0.15, cy: 0.80, ox: 0.14, oy: 0.12, px: 1.1, py: 3.9, period: 23, r: 0.40 },
        { color: white, alpha: 0.06, cx: 0.85, cy: 0.85, ox: 0.12, oy: 0.10, px: 5.2, py: 1.2, period: 11, r: 0.35 },
      ]
    }

    const resize = () => {
      canvas.width = Math.max(2, Math.round(host.clientWidth / SCALE))
      canvas.height = Math.max(2, Math.round(host.clientHeight / SCALE))
    }

    let raf = 0
    let last = 0
    const TAU = Math.PI * 2
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden || !visibleRef.current) return
      if (t - last < FRAME_MS) return
      last = t

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const time = t / 1000
      for (const b of blobs) {
        const x = (b.cx + Math.sin((time * TAU) / b.period + b.px) * b.ox) * w
        const y = (b.cy + Math.cos((time * TAU) / b.period + b.py) * b.oy) * h
        const r = Math.max(4, b.r * w)
        const [cr, cg, cb] = b.color
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${b.alpha * intensity})`)
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
    }

    buildBlobs()
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    // Re-resolve token colors when the theme class flips on <html>
    const mo = new MutationObserver(buildBlobs)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
    }
  }, [active, intensity, ref])

  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      {active && (
        <canvas ref={canvasRef} className="w-full h-full" style={{ filter: 'blur(50px)', transform: 'scale(1.1)' }} />
      )}
    </div>
  )
}
