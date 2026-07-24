import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query from React.
 *
 * useSyncExternalStore (rather than useState + useEffect) so the very first
 * render already has the correct value — a resize-listener version renders the
 * desktop tree once and then corrects itself, which on a phone shows a visible
 * flash of the desktop shell before the drawer collapses.
 */
/**
 * One MediaQueryList per distinct query, shared by every consumer.
 *
 * getSnapshot runs on every render of every component using the hook — and
 * some of those re-render per pointer-move during a drag — so constructing a
 * fresh MediaQueryList there was pure churn. There are only a handful of
 * distinct queries in the app, so caching them for the page's lifetime is
 * bounded.
 */
const mqlCache = new Map<string, MediaQueryList>()

function getMediaQueryList(query: string): MediaQueryList {
  let mql = mqlCache.get(query)
  if (!mql) {
    mql = window.matchMedia(query)
    mqlCache.set(query, mql)
  }
  return mql
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = getMediaQueryList(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => getMediaQueryList(query).matches, [query])

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    // Server/prerender fallback: assume desktop, matching the app's origins.
    () => false,
  )
}

/**
 * The app's one phone/desktop cut. Mirrors Tailwind's `md` (48rem/768px), so
 * `useIsMobile()` in TS and `md:` in class names always agree — if this changes,
 * every `md:` prefix in the app has to change with it.
 */
export const MOBILE_QUERY = '(max-width: 767px)'

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}

/**
 * True for touch/pen input. Distinct from useIsMobile: a small browser window on
 * a desktop is "mobile" but still has a fine pointer, and a large tablet is not
 * "mobile" but still cannot hover. Use this one for anything about *input*
 * (tap targets, hover-revealed controls, drag activation) and useIsMobile for
 * anything about *space* (layout, drawers, column counts).
 */
export function useIsCoarsePointer(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}

/**
 * Phone *and* tablet — anything below Tailwind's `lg` (64rem/1024px).
 *
 * Distinct from useIsMobile because a tablet is wide enough for a real 7-column
 * month grid but not for the desktop calendar chrome (a 3-way view switcher, a
 * board filter with its count label, and a full month title on one line). The
 * calendar is currently the only surface that needs the middle case; other
 * views only care about the phone/desktop split at `md`.
 */
export function useIsCompactViewport(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}
