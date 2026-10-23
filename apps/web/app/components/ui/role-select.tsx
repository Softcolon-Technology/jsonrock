'use client'

import { Check, ChevronDown } from 'lucide-react'
import type { InviteRole } from '@/types/library'
import { cn } from '@/lib/utils'
import { DropdownMenu } from './dropdown-menu'

export type RoleSelectValue = InviteRole | 'remove'

export interface RoleSelectProps {
  value: InviteRole
  onChange: (value: RoleSelectValue) => void
  /** Accessible label, e.g. "Role for Priya Shah". */
  label: string
  /** Show the "Remove…" option (member rows). */
  allowRemove?: boolean
  disabled?: boolean
  /** `md` = invite form (38px), `sm` = member row (32px). */
  size?: 'sm' | 'md'
  className?: string
  testId?: string
}

const ROLE_LABEL: Record<InviteRole, string> = {
  editor: 'Editor',
  viewer: 'Viewer',
}

/** Custom dropdown (matches Files filters) — not a native `<select>`. */
export function RoleSelect({
  value,
  onChange,
  label,
  allowRemove,
  disabled,
  size = 'sm',
  className,
  testId,
}: RoleSelectProps) {
  const items = [
    {
      key: 'editor' as const,
      label: 'Editor',
      onSelect: () => onChange('editor'),
    },
    {
      key: 'viewer' as const,
      label: 'Viewer',
      onSelect: () => onChange('viewer'),
    },
    ...(allowRemove
      ? [
          {
            key: 'remove' as const,
            label: 'Remove…',
            danger: true,
            onSelect: () => onChange('remove'),
          },
        ]
      : []),
  ]

  return (
    <DropdownMenu
      align='end'
      menuTestId={testId ? `${testId}-menu` : undefined}
      items={items.map((i) => ({
        key: i.key,
        label: i.label,
        danger: 'danger' in i ? i.danger : undefined,
        disabled,
        icon:
          i.key !== 'remove' && value === i.key ? (
            <Check size={14} />
          ) : (
            <span className='w-3.5' />
          ),
        onSelect: i.onSelect,
        testId: testId ? `${testId}-${i.key}` : undefined,
      }))}
      renderTrigger={(p) => (
        <button
          type='button'
          {...p}
          disabled={disabled}
          aria-label={label}
          data-testid={testId}
          title={label}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 border border-[var(--jr-border)] bg-[var(--jr-surface)] font-semibold text-[var(--jr-text)] outline-none transition-colors hover:border-[var(--jr-accent)] focus-visible:border-[var(--jr-accent)] focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] disabled:cursor-not-allowed disabled:opacity-60',
            size === 'md'
              ? 'h-[38px] rounded-[10px] px-2.5 text-sm'
              : 'h-8 rounded-lg px-2 text-xs',
            className
          )}
        >
          {ROLE_LABEL[value]}
          <ChevronDown size={size === 'md' ? 14 : 12} aria-hidden='true' />
        </button>
      )}
    />
  )
}
