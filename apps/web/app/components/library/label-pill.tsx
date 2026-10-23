'use client'

import { cn } from '@/lib/utils'
import type { FileLabel } from '@/types/library'

export function LabelPill({
  label,
  size = 'sm',
  className,
}: {
  label: FileLabel
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      data-testid={`jr-label-${label.id}`}
      title={label.name}
      className={cn(
        'inline-flex max-w-[120px] items-center truncate rounded-full font-semibold',
        size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs',
        className
      )}
      style={{
        backgroundColor: `${label.color}22`,
        color: label.color,
        border: `1px solid ${label.color}55`,
      }}
    >
      {label.name}
    </span>
  )
}
