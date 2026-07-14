import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '../ui/Badge'

const PRIORITY_TONES: Record<string, BadgeTone> = {
  urgent: 'danger',
  high:   'warning',
  medium: 'accent',
  low:    'neutral',
}

export function PriorityPill({ priority }: { priority?: string | null }) {
  const { t } = useTranslation()
  const tone = PRIORITY_TONES[priority ?? 'low'] ?? PRIORITY_TONES.low
  return <Badge tone={tone}>{t(`priority.${priority ?? 'low'}`)}</Badge>
}
