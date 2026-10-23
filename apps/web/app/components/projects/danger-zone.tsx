'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { pluralize } from '@/lib/library-format'

export interface DangerZoneProps {
  fileCount: number
  onDelete: () => Promise<void>
}

export function DangerZone({ fileCount, onDelete }: DangerZoneProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div
      data-testid='danger-zone'
      className='mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-[18px] py-4'
    >
      <div className='flex flex-col gap-[3px]'>
        <div className='font-semibold'>Delete project</div>
        <div className='text-[13px] text-[var(--jr-muted)]'>
          Removes all {pluralize(fileCount, 'remote file')}, members and pending
          invites. Local copies on your device are cleared too.
        </div>
        {error && (
          <div role='alert' className='text-[13px] text-[var(--jr-danger)]'>
            {error}
          </div>
        )}
      </div>
      <Button
        variant='danger-outline'
        className='h-[38px] px-3.5'
        onClick={() => setOpen(true)}
        data-testid='jr-delete-project'
      >
        Delete project…
      </Button>

      <ConfirmDialog
        open={open}
        variant='danger'
        testId='delete-project-dialog'
        title='Delete this project?'
        description={`This permanently removes ${pluralize(fileCount, 'remote file')}, all members and pending invites. This can’t be undone.`}
        confirmLabel='Delete project'
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true)
          setError(null)
          try {
            await onDelete()
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Could not delete project'
            )
            setOpen(false)
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}
