// Shared color swatches for board/label pickers (Sidebar, BoardTemplateModal,
// TaskPanel). Habit colors use a separate, differently-valued named palette
// (see HabitFormModal.tsx) — not consolidated here since the values genuinely
// differ, not just the shape.
export const SWATCH_COLORS: string[] = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

export const BOARD_SWATCH_COLORS: (string | null)[] = [null, ...SWATCH_COLORS]
