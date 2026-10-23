'use client'

import { Search } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Accessible label (visually hidden). */
  label: string
  className?: string
  height?: number
  testId?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
  testId,
}: SearchInputProps) {
  const id = useId()
  return (
    <div
      className={cn(
        'box-border flex h-9 w-60 items-center gap-2 rounded-[10px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-3 text-[var(--jr-muted)] focus-within:border-[var(--jr-accent)]',
        className
      )}
    >
      <Search size={15} aria-hidden='true' className='shrink-0' />
      <label htmlFor={id} className='sr-only'>
        {label}
      </label>
      <input
        id={id}
        type='search'
        data-testid={testId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className='w-full border-0 bg-transparent text-sm text-[var(--jr-text)] outline-none placeholder:text-[var(--jr-muted-2)]'
      />
    </div>
  )
}
