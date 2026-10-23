'use client'

import { useId, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export interface EditableTitleProps {
  /** Current (draft) value. */
  value: string
  onChange: (value: string) => void
  /** Enter (inline) or blur (heading). */
  onSubmit: () => void
  onCancel: () => void
  label: string
  maxLength?: number
  /**
   * `inline` — row rename: bordered input + "Press Enter to save · 18 / 60" hint.
   * `heading` — 26px page title that looks like text until focused.
   */
  variant?: 'inline' | 'heading'
  autoFocus?: boolean
  readOnly?: boolean
  disabled?: boolean
  error?: string | null
  className?: string
  testId?: string
}

export function EditableTitle({
  value,
  onChange,
  onSubmit,
  onCancel,
  label,
  maxLength = 60,
  variant = 'inline',
  autoFocus,
  readOnly,
  disabled,
  error,
  className,
  testId,
}: EditableTitleProps) {
  const id = useId()

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (variant === 'heading') e.currentTarget.blur()
      else onSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      if (variant === 'heading') e.currentTarget.blur()
    }
  }

  if (variant === 'heading') {
    return (
      <>
        <label htmlFor={id} className='sr-only'>
          {label}
        </label>
        <input
          id={id}
          type='text'
          data-testid={testId}
          value={value}
          maxLength={maxLength}
          readOnly={readOnly}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSubmit}
          onKeyDown={onKeyDown}
          className={cn(
            '-ml-2 w-80 max-w-full rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-[26px] font-bold tracking-[-0.02em] text-[var(--jr-text)] outline-none max-sm:w-full max-sm:text-[22px]',
            !readOnly &&
              'hover:border-[var(--jr-border)] focus:border-[var(--jr-accent)] focus:bg-[var(--jr-surface)]',
            className
          )}
        />
      </>
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-1', className)}>
      <label htmlFor={id} className='sr-only'>
        {label}
      </label>
      <input
        id={id}
        type='text'
        data-testid={testId}
        value={value}
        maxLength={maxLength}
        autoFocus={autoFocus}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className='h-[34px] max-w-[360px] rounded-lg border-[1.5px] border-[var(--jr-accent)] bg-[var(--jr-surface)] px-2.5 font-semibold text-[var(--jr-text)] outline-none'
      />
      {error ? (
        <span role='alert' className='text-xs text-[var(--jr-danger)]'>
          {error}
        </span>
      ) : (
        <span className='text-xs text-[var(--jr-muted)]'>
          Press Enter to save · {value.length} / {maxLength}
        </span>
      )}
    </div>
  )
}
