'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { InviteForm } from './invite-form'
import { MemberRow } from './member-row'
import { PendingInviteRow } from './pending-invite-row'
import type { RoleSelectValue } from '../ui/role-select'
import type { InviteRole, ProjectInvite, ProjectMember } from '@/types/library'

export interface PeoplePanelProps {
  members: ProjectMember[]
  invites: ProjectInvite[]
  isOwner: boolean
  onInvite: (email: string, role: InviteRole) => Promise<void>
  onSetRole: (userId: string, role: InviteRole) => Promise<void>
  onRemove: (userId: string) => Promise<void>
  onRevoke: (inviteId: string) => Promise<void>
  onLeave: () => Promise<void>
}

export function PeoplePanel({
  members,
  invites,
  isOwner,
  onInvite,
  onSetRole,
  onRemove,
  onRevoke,
  onLeave,
}: PeoplePanelProps) {
  const [removing, setRemoving] = useState<ProjectMember | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyInvite, setBusyInvite] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const guard = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const changeRole = (member: ProjectMember, value: RoleSelectValue) => {
    if (value === 'remove') setRemoving(member)
    else if (value !== member.role)
      void guard(() => onSetRole(member.userId, value))
  }

  return (
    <aside
      aria-label='People'
      data-testid='jr-people'
      className='flex w-full min-w-0 flex-col gap-3 lg:max-w-[380px] lg:shrink-0'
    >
      <h2 className='m-0 text-base font-semibold'>
        People{' '}
        <span className='font-medium text-[var(--jr-muted-2)]'>
          · {members.length}
        </span>
      </h2>

      <div className='flex flex-col overflow-hidden rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)]'>
        {isOwner && <InviteForm onInvite={onInvite} />}

        {members.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            canManage={isOwner}
            onChangeRole={changeRole}
          />
        ))}

        {isOwner && invites.length > 0 && (
          <>
            <div className='px-4 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--jr-muted)]'>
              Pending · {invites.length}
            </div>
            {invites.map((inv) => {
              const key = inv.token ?? inv.id ?? ''
              return (
                <PendingInviteRow
                  key={key}
                  invite={inv}
                  canRevoke
                  busy={busyInvite === key}
                  onRevoke={async (i) => {
                    const token = i.token ?? i.id
                    if (!token) return
                    setBusyInvite(token)
                    await guard(() => onRevoke(token))
                    setBusyInvite(null)
                  }}
                />
              )
            })}
          </>
        )}

        {!isOwner && (
          <div className='p-4'>
            <Button
              variant='danger-outline'
              className='h-[38px] w-full'
              onClick={() => setLeaving(true)}
              data-testid='jr-leave-project'
            >
              Leave project
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role='alert' className='m-0 text-xs text-[var(--jr-danger)]'>
          {error}
        </p>
      )}

      <p className='m-0 text-xs leading-normal text-[var(--jr-muted)]'>
        Owner manages people. Editors can create, edit, rename and move files.
        Viewers are read-only. Non-owners see a{' '}
        <strong className='font-semibold'>Leave project</strong> button here
        instead of role controls.
      </p>

      <ConfirmDialog
        open={!!removing}
        variant='danger'
        testId='remove-member-dialog'
        title={`Remove ${removing?.name ?? 'member'}?`}
        description='They will lose access to all files in this project immediately.'
        confirmLabel='Remove'
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          setBusy(true)
          await guard(() => onRemove(removing.userId))
          setBusy(false)
          setRemoving(null)
        }}
      />
      <ConfirmDialog
        open={leaving}
        variant='danger'
        testId='leave-project-dialog'
        title='Leave this project?'
        description='You will lose access to its files. You can rejoin only if the owner invites you again.'
        confirmLabel='Leave project'
        busy={busy}
        onCancel={() => setLeaving(false)}
        onConfirm={async () => {
          setBusy(true)
          await guard(onLeave)
          setBusy(false)
          setLeaving(false)
        }}
      />
    </aside>
  )
}
