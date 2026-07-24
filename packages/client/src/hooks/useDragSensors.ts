import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * Shared drag sensors for every sortable surface in the app (the Kanban board
 * and the notes/folders tree).
 *
 * Previously each context registered PointerSensor alone with a 5px distance
 * constraint. Pointer events cover touch too, so on a phone the browser saw
 * the first pixels of a drag as the start of a scroll, claimed the gesture and
 * fired pointercancel — the drag either never started or died mid-gesture.
 *
 * The fix is to split the input paths rather than unify them, because mouse and
 * touch want opposite activation rules:
 *
 *   - Mouse has no scroll ambiguity, so a small movement can mean "drag"
 *     immediately. Keeps the previous 5px feel exactly.
 *   - Touch is ambiguous — the same downward swipe means "scroll the column"
 *     or "drag this card" — so it needs a press-and-hold to disambiguate.
 *
 * Deliberately NOT paired with `touch-action: none` on draggables. That is the
 * documented companion to a *distance*-activated pointer sensor, but here it
 * would disable native scrolling on the task cards that fill the scrollable
 * column, making the board unscrollable on touch. With delay-based activation
 * dnd-kit suppresses the default itself once the drag actually starts, and a
 * finger that moves before the delay elapses simply scrolls as normal.
 */
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // 200ms hold; the 5px tolerance keeps an unsteady finger from cancelling
    // activation before the delay elapses.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    // The app previously had no non-pointer way to reorder anything at all.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}
