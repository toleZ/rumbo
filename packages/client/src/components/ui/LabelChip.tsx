import { X } from 'lucide-react'

interface LabelChipProps {
  color: string
  name: string
  size?: 'xs' | 'sm'
  onClick?: () => void
  removable?: boolean
}

export function LabelChip({ color, name, size = 'xs', onClick, removable }: LabelChipProps) {
  const sizeCls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs font-medium px-2 py-0.5'
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full font-semibold text-white whitespace-nowrap ${sizeCls} ${
        onClick ? 'cursor-pointer opacity-90 hover:opacity-100' : ''
      }`}
      style={{ backgroundColor: color }}
    >
      {name}
      {removable && <X className="w-3 h-3" />}
    </span>
  )
}
