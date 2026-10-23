import type { HTMLAttributes } from 'react'
import type { Role } from '@/types/library'
import { cn } from '@/lib/utils'

export type PillTone =
  | 'neutral'
  | 'blue'
  | 'slate'
  | 'accent'
  | 'danger'
  | 'warning'

const tones: Record<PillTone, string> = {
  neutral: 'bg-[var(--jr-hover)] text-[var(--jr-text-2)]',
  blue: 'bg-[#eff6ff] text-[#1d4ed8] dark:bg-blue-950/40 dark:text-blue-300',
  slate: 'bg-[var(--jr-hover)] text-[var(--jr-text-2)]',
  accent: 'bg-[var(--jr-accent-soft)] text-[var(--jr-accent-hover)]',
  danger: 'bg-[var(--jr-danger-soft)] text-[var(--jr-danger)]',
  warning:
    'bg-[#fff7ed] text-[#9a3412] dark:bg-orange-950/40 dark:text-orange-300',
}

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone
}

export function Pill({ tone = 'neutral', className, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.04em]',
        tones[tone],
        className
      )}
      {...props}
    />
  )
}

const roleTone: Record<Role, PillTone> = {
  owner: 'neutral',
  editor: 'blue',
  viewer: 'slate',
}

const roleLabel: Record<Role, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
}

export function RolePill({
  role,
  children,
  ...props
}: Omit<PillProps, 'tone'> & { role: Role }) {
  return (
    <Pill tone={roleTone[role]} {...props}>
      {children ?? roleLabel[role]}
    </Pill>
  )
}
