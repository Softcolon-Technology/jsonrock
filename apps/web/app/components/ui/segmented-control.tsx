'use client'

import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Muted count shown after the label. */
  count?: number
  testId?: string
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role='tablist'
      aria-label={ariaLabel}
      className={cn(
        'inline-flex rounded-[10px] bg-[var(--jr-hover)] p-0.5',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type='button'
            role='tab'
            aria-selected={active}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 cursor-pointer rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)]',
              active
                ? 'bg-[var(--jr-surface)] text-[var(--jr-text)] shadow-sm'
                : 'text-[var(--jr-muted)] hover:text-[var(--jr-text)]'
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className='ml-1.5 font-medium text-[var(--jr-muted-2)]'>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
