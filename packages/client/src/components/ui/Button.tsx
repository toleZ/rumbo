import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

// Primary is the near-black/near-white ink pill from the design spec — it
// deliberately does NOT use --accent, since brand violet is reserved for
// secondary CTAs and module identity, not the loudest action on a screen.
const VARIANT_STYLES: Record<Variant, string> = {
  primary:   'bg-[var(--label)] text-[var(--bg)] hover:opacity-90 rounded-[var(--radius-full)]',
  secondary: 'bg-[var(--accent-f)] text-[var(--accent-h)] border border-[var(--accent)] hover:bg-[var(--accent-f)] rounded-[var(--radius-full)]',
  ghost:     'bg-[var(--surface-2)] text-[var(--label-2)] hover:bg-[var(--surface-3)] rounded-[var(--radius-md)]',
  danger:    'bg-[var(--danger)] text-white hover:opacity-90 rounded-[var(--radius-md)]',
}

const SIZE_STYLES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold gap-1.5',
  md: 'px-4 py-2 text-sm font-medium gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-[background-color,opacity,transform] duration-[160ms] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}
