import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title?: string
  description: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
  testId?: string
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  testId = 'empty-state',
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-[var(--jr-border)] bg-[var(--jr-surface)] px-6 py-10 text-center',
        className
      )}
    >
      {icon && (
        <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--jr-accent-soft)] text-[var(--jr-accent-hover)]'>
          {icon}
        </span>
      )}
      {title && (
        <h3 className='m-0 text-[15px] font-semibold text-[var(--jr-text)]'>
          {title}
        </h3>
      )}
      <p className='m-0 max-w-md text-[13px] text-[var(--jr-muted)]'>
        {description}
      </p>
      {action}
    </div>
  )
}
