// Single source of truth for JS-driven motion (the `motion` library and
// hand-rolled rAF loops). CSS animations keep using the custom-property
// tokens in index.css — the values here mirror those tokens exactly so a
// spring in React and a keyframe in CSS feel like the same house physics.
import type { Transition } from 'motion/react'

// ── Springs ──────────────────────────────────────────────────────────────────
// springSnappy matches the ActionRing widget spring — the app's established
// "UI element snaps into place" feel.
export const springSnappy: Transition = { type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }
export const springGentle: Transition = { type: 'spring', stiffness: 260, damping: 30 }
export const springBouncy: Transition = { type: 'spring', stiffness: 520, damping: 22 }

// ── Easings (mirror the CSS tokens in index.css) ─────────────────────────────
export const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1] // --ease-out
export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1] // --ease-out-expo
export const easeInOut: [number, number, number, number] = [0.77, 0, 0.175, 1] // --ease-in-out
export const easeDrawer: [number, number, number, number] = [0.32, 0.72, 0, 1] // --ease-drawer

// ── Durations (seconds, for motion props; mirror --dur-* in index.css) ───────
export const DUR = {
  micro: 0.12,
  hover: 0.16,
  view: 0.24,
  panel: 0.3,
  reveal: 0.62,
} as const

// ── Shared variants ──────────────────────────────────────────────────────────
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

export const scalePop = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
}

export const listContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
}

export const listItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
}

// For non-React code paths (canvas loops, rAF effects) where the
// useReducedMotion() hook isn't available.
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
