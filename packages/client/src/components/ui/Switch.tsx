interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

// Generic on/off toggle — the app has segmented multi-choice buttons (see
// HabitFormModal) but no binary switch primitive yet. Pill shape mirrors
// Button's primary variant (rounded-full), accent fill when on.
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-[160ms] disabled:opacity-50 disabled:pointer-events-none ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-[160ms] ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
