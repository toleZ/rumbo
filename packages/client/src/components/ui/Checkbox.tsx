import { Check } from 'lucide-react'

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
  const boxCls = `${sizeCls} ${shapeCls} border flex items-center justify-center shrink-0 transition-colors ${
    checked ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--sep)]'
  } ${className}`
  const icon = checked ? <Check className={`${iconCls} text-white`} strokeWidth={3} /> : null

  if (!onChange) {
    return <span className={boxCls}>{icon}</span>
  }
  return (
    <button type="button" onClick={onChange} className={`${boxCls} hover:border-[var(--accent)]`}>
      {icon}
    </button>
  )
}
