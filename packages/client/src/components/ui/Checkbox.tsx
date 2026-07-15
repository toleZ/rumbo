interface CheckboxProps {
  checked: boolean
  /** Omit when nested inside an already-clickable row — renders as a plain
      (non-nested-button) indicator instead of its own button. */
  onChange?: () => void
  shape?: 'square' | 'circle'
  size?: 'sm' | 'md'
  className?: string
}

export function Checkbox({ checked, onChange, shape = 'square', size = 'sm', className = '' }: CheckboxProps) {
  const sizeCls = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const shapeCls = shape === 'circle' ? 'rounded-full' : 'rounded-[var(--radius-xs)]'
  const iconCls = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'
  const boxCls = `${sizeCls} ${shapeCls} border flex items-center justify-center shrink-0 transition-colors duration-[120ms] ${
    checked ? 'bg-[var(--accent)] border-[var(--accent)] animate-check-pop' : 'border-[var(--sep)]'
  } ${className}`
  // Inline SVG instead of the lucide Check so the stroke can draw itself in:
  // dashoffset transitions from full length to 0 when checked, slightly after
  // the box pops. Both collapse to instant states under reduced motion.
  const icon = (
    <svg className={iconCls} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.2 L4.8 9 L10 3.4"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        className={`check-draw ${checked ? 'check-draw-in' : ''}`}
      />
    </svg>
  )

  if (!onChange) {
    return <span className={boxCls}>{icon}</span>
  }
  return (
    <button type="button" onClick={onChange} className={`${boxCls} hover:border-[var(--accent)] active:scale-90 transition-[background-color,border-color,transform] duration-[120ms]`}>
      {icon}
    </button>
  )
}
