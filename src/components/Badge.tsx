import type { Badge } from '../lib/types'

// Preserve existing tone identifiers; their presentation follows the current brand.
const TONE_CLASSES: Record<Badge['tone'], string> = {
  emerald: 'bg-brand-100 text-brand-800 ring-brand-200',
  teal: 'bg-stone-100 text-stone-800 ring-stone-200',
  sky: 'bg-sky-100 text-sky-800 ring-sky-200',
  amber: 'bg-amber-100 text-amber-900 ring-amber-200',
}

export function BadgeList({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <li
          key={badge.label}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[badge.tone]}`}
        >
          {badge.label}
        </li>
      ))}
    </ul>
  )
}
