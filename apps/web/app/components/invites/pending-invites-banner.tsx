'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Avatar } from '../ui/avatar'
import { Button } from '../ui/button'
import { useInvites } from '@/hooks/use-invites'
import { formatRelative } from '@/lib/library-format'

export interface PendingInvitesBannerProps {
  /** Called after an invite is accepted or declined (e.g. refresh library). */
  onResolved?: () => void
}

export function PendingInvitesBanner({
  onResolved,
}: PendingInvitesBannerProps) {
  const router = useRouter()
  const { invites, busyToken, accept, decline } = useInvites()
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  if (invites.length === 0) return null

  const invite = invites[index % invites.length]!
  const token = invite.token ?? invite.id
  const busy = busyToken === token
  const more = invites.length - 1

  const run = async (kind: 'accept' | 'decline') => {
    setError(null)
    try {
      if (kind === 'accept') {
        const res = await accept(token)
        onResolved?.()
        router.push(
          `/workspace/projects/${encodeURIComponent(res?.projectId ?? invite.projectId)}`
        )
      } else {
        await decline(token)
        onResolved?.()
      }
      setIndex(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <section
      aria-label='Pending invites'
      data-testid='jr-invite-banner'
      className='flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#a7f3d0] bg-[var(--jr-surface)] px-[18px] py-4 max-sm:flex-col max-sm:items-stretch'
    >
      <div className='flex min-w-0 items-center gap-3.5'>
        <Avatar
          name={invite.invitedByName ?? 'Someone'}
          colorKey={invite.invitedByEmail ?? invite.invitedByName}
          imageUrl={invite.invitedByImageUrl}
          size={40}
        />
        <div className='flex min-w-0 flex-col gap-[3px]'>
          <div className='text-[15px] font-semibold'>
            <strong className='font-bold'>
              {invite.invitedByName ?? 'Someone'}
            </strong>{' '}
            invited you to{' '}
            <strong className='font-bold'>{invite.projectName}</strong> as{' '}
            {invite.role === 'editor' ? 'Editor' : 'Viewer'}
          </div>
          <div className='text-[13px] text-[var(--jr-muted)]'>
            Sent {formatRelative(invite.createdAt)}
            {invite.invitedByEmail ? ` · ${invite.invitedByEmail}` : ''}
            {more > 0 && (
              <>
                {' · '}
                <button
                  type='button'
                  onClick={() => setIndex((i) => i + 1)}
                  className='cursor-pointer border-0 bg-transparent p-0 font-medium text-[var(--jr-accent-hover)] hover:underline'
                >
                  {more} more pending {more === 1 ? 'invite' : 'invites'}
                </button>
              </>
            )}
          </div>
          {error && (
            <div role='alert' className='text-[13px] text-[var(--jr-danger)]'>
              {error}
            </div>
          )}
        </div>
      </div>
      <div className='flex items-center gap-2 max-sm:[&>button]:flex-1'>
        <Button
          variant='secondary'
          className='h-[38px] text-[#334155]'
          disabled={busy}
          onClick={() => run('decline')}
          data-testid='jr-invite-decline'
        >
          Decline
        </Button>
        <Button
          variant='primary'
          className='h-[38px]'
          disabled={busy}
          onClick={() => run('accept')}
          data-testid='jr-invite-accept'
        >
          Accept invite
        </Button>
      </div>
    </section>
  )
}
