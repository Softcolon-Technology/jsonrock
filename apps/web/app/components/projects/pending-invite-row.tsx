'use client'

import { Mail } from 'lucide-react'
import { Button } from '../ui/button'
import { formatRelative } from '@/lib/library-format'
import type { ProjectInvite } from '@/types/library'

export interface PendingInviteRowProps {
  invite: ProjectInvite
  canRevoke?: boolean
  busy?: boolean
  onRevoke?: (invite: ProjectInvite) => void
}

export function PendingInviteRow({
  invite,
  canRevoke,
  busy,
  onRevoke,
}: PendingInviteRowProps) {
  return (
    <div
      data-testid={`jr-pending-${invite.token ?? invite.id}`}
      data-invite-id={invite.id}
      className='flex items-center gap-3 border-b border-[var(--jr-border)] px-4 py-2.5 last:border-b-0 max-sm:flex-wrap'
    >
      <span className='flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#cbd5e1] text-[var(--jr-muted-2)]'>
        <Mail size={15} />
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-px'>
        <span className='truncate font-semibold text-[#334155]'>
          {invite.email}
        </span>
        <span className='flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--jr-muted)]'>
          {invite.role === 'editor' ? 'Editor' : 'Viewer'} · emailed{' '}
          {formatRelative(invite.createdAt)}
          {invite.noAccount && <> · no account yet</>}
        </span>
      </div>
      {canRevoke && (
        <Button
          variant='secondary'
          disabled={busy}
          onClick={() => onRevoke?.(invite)}
          className='h-[30px] rounded-lg px-2.5 text-xs text-[#334155]'
          data-testid={`jr-revoke-${invite.token ?? invite.id}`}
        >
          Revoke
        </Button>
      )}
    </div>
  )
}
