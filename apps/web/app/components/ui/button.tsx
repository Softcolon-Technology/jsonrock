import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-outline'
export type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-0 bg-[var(--jr-accent)] text-white hover:bg-[var(--jr-accent-hover)]',
  secondary:
    'border border-[var(--jr-border)] bg-[var(--jr-surface)] text-[var(--jr-text)] hover:bg-[var(--jr-bg)]',
  ghost:
    'border-0 bg-transparent text-[var(--jr-muted)] hover:bg-[var(--jr-hover)] hover:text-[var(--jr-text)]',
  danger: 'border-0 bg-[var(--jr-danger)] text-white hover:bg-[#991b1b]',
  'danger-outline':
    'border border-[#fecaca] bg-[var(--jr-surface)] text-[var(--jr-danger)] hover:bg-[var(--jr-danger-soft)]',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-[34px] rounded-lg px-3 text-[13px]',
  md: 'h-10 rounded-[10px] px-4 text-sm',
}

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(base, variants[variant], sizes[size], className)
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
}
