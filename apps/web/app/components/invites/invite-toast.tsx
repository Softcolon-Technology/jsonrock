'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { Avatar } from '../ui/avatar'
import { formatRelative, pluralize } from '@/lib/library-format'
import type { ProjectInvite } from '@/types/library'

export interface InviteToastProps {
  invite: ProjectInvite
  /** Other pending invites that aren't shown. */
  moreCount?: number
  busy?: boolean
  error?: string | null
  onAccept: () => void
  onDecline: () => void
  /** Session-only hide — the invite stays pending. */
  onDismiss: () => void
}

function stats(invite: ProjectInvite): string {
  const parts: string[] = []
  if (typeof invite.projectFileCount === 'number')
    parts.push(pluralize(invite.projectFileCount, 'file'))
  if (typeof invite.projectMemberCount === 'number')
    parts.push(pluralize(invite.projectMemberCount, 'member'))
  parts.push('also sent to your email')
  return parts.join(' · ')
}

/** Bottom-right live invite card (screen.html frame 04). */
export function InviteToast({
  invite,
  moreCount = 0,
  busy,
  error,
  onAccept,
  onDecline,
  onDismiss,
}: InviteToastProps) {
  const token = invite.token ?? invite.id
  const inviter = invite.invitedByName ?? invite.invitedByEmail ?? 'Someone'

  return (
    <div
      role='status'
      aria-live='polite'
      data-testid={`jr-invite-toast-${token}`}
      className='fixed bottom-6 right-6 z-[90] box-border flex w-[400px] max-w-[calc(100vw-1.5rem)] flex-col gap-3.5 rounded-2xl border border-[var(--jr-border)] bg-[var(--jr-surface)] p-4 text-[var(--jr-text)] shadow-[0_12px_32px_rgba(15,23,42,0.14)] max-sm:bottom-3 max-sm:right-3'
    >
      <div className='flex items-start gap-3'>
        <Avatar
          name={inviter}
          colorKey={invite.invitedByEmail ?? inviter}
          imageUrl={invite.invitedByImageUrl}
          size={40}
        />
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--jr-accent-hover)]'>
              Project invite
            </span>
            <span className='text-xs text-[var(--jr-muted-2)]'>
              {formatRelative(invite.createdAt) || 'just now'}
            </span>
            {moreCount > 0 && (
              <span className='text-xs text-[var(--jr-muted)]'>
                +{moreCount} more
              </span>
            )}
          </div>
          <p className='m-0 text-sm leading-[1.45]'>
            <strong className='font-bold'>{inviter}</strong> invited you to{' '}
            <strong className='font-bold'>{invite.projectName}</strong> as{' '}
            <strong className='font-bold'>
              {invite.role === 'editor' ? 'Editor' : 'Viewer'}
            </strong>
            .
          </p>
          <span className='text-xs text-[var(--jr-muted)]'>
            {stats(invite)}
          </span>
          {error && (
            <span role='alert' className='text-xs text-[var(--jr-danger)]'>
              {error}
            </span>
          )}
        </div>
        <button
          type='button'
          aria-label='Dismiss for now'
          title='Dismiss for now'
          data-testid='jr-toast-dismiss'
          onClick={onDismiss}
          className='inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[var(--jr-muted-2)] transition-colors hover:bg-[var(--jr-hover)] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)]'
        >
          <X size={16} />
        </button>
      </div>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          data-testid='jr-toast-accept'
          disabled={busy}
          onClick={onAccept}
          className='h-[38px] flex-1 cursor-pointer rounded-[10px] border-0 bg-[var(--jr-accent)] text-sm font-semibold text-white transition-colors hover:bg-[var(--jr-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
        >
          Accept
        </button>
        <button
          type='button'
          data-testid='jr-toast-decline'
          disabled={busy}
          onClick={onDecline}
          className='h-[38px] cursor-pointer rounded-[10px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-3.5 text-sm font-semibold text-[#334155] transition-colors hover:bg-[var(--jr-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] disabled:cursor-not-allowed disabled:opacity-50'
        >
          Decline
        </button>
        <Link
          href='/workspace'
          className='ml-auto text-[13px] font-semibold text-[var(--jr-accent-hover)] no-underline hover:underline'
        >
          View in Workspace
        </Link>
      </div>
    </div>
  )
}
