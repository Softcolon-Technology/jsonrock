'use client'

import { useAuth } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Dialog, DialogFooter, DialogHeader } from '../ui/dialog'
import { PendingInvitesBanner } from '../invites/pending-invites-banner'
import { MoveToProjectDialog } from '../projects/move-to-project-dialog'
import { LibraryHeader } from './library-header'
import { ProjectsGrid } from './projects-grid'
import { StandaloneFilesList } from './standalone-files-list'
import { errorMessage, useLibrary } from '@/hooks/use-library'
import { createRemoteFile } from '@/lib/create-project-file'
import type { DocType, RemoteFile } from '@/types/library'

export function LibraryPage() {
  const { getToken } = useAuth()
  const lib = useLibrary()
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [moving, setMoving] = useState<RemoteFile | null>(null)
  const [deleting, setDeleting] = useState<RemoteFile | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [creatingFile, setCreatingFile] = useState(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleNewFile = async (type: DocType) => {
    if (creatingFile) return
    setActionError(null)
    setCreatingFile(true)
    try {
      const { file } = await createRemoteFile(getToken, type)
      lib.prependStandalone(file)
      setEditingSlug(file.slug)
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="file-rename-input"]'
        )
        input?.focus()
        input?.select()
      }, 0)
    } catch (e) {
      setActionError(errorMessage(e, 'Could not create file'))
    } finally {
      setCreatingFile(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    setActionError(null)
    try {
      await lib.remove(deleting.slug)
      setDeleting(null)
    } catch (e) {
      setActionError(errorMessage(e, 'Could not delete file'))
      setDeleting(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <main
      data-testid='jr-library'
      className='mx-auto box-border flex w-full max-w-[1080px] flex-col gap-8 px-7 pb-16 pt-9 max-sm:gap-6 max-sm:px-4 max-sm:pb-12 max-sm:pt-5'
    >
      <PendingInvitesBanner onResolved={lib.refresh} />

      <LibraryHeader
        onNewProject={() => setNewProjectOpen(true)}
        onNewFile={(type) => void handleNewFile(type)}
        creatingFile={creatingFile}
      />

      {lib.error && (
        <div
          role='alert'
          data-testid='library-error'
          className='flex items-center justify-between gap-3 rounded-xl border border-[#fecaca] bg-[var(--jr-danger-soft)] px-4 py-3 text-sm text-[var(--jr-danger)]'
        >
          <span>{lib.error}</span>
          <Button
            size='sm'
            variant='secondary'
            onClick={() => void lib.refresh()}
          >
            Retry
          </Button>
        </div>
      )}
      {actionError && (
        <div
          role='alert'
          className='rounded-xl border border-[#fecaca] bg-[var(--jr-danger-soft)] px-4 py-3 text-sm text-[var(--jr-danger)]'
        >
          {actionError}
        </div>
      )}

      {lib.loading ? (
        <LibrarySkeleton />
      ) : (
        <div className='relative flex flex-col gap-8'>
          {lib.refreshing && (
            <div
              role='status'
              aria-live='polite'
              className='absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 rounded-full border border-[var(--jr-border)] bg-[var(--jr-surface)] px-2.5 py-1 text-xs font-medium text-[var(--jr-muted)] shadow-sm'
            >
              <Loader2 size={12} className='animate-spin' aria-hidden='true' />
              Updating…
            </div>
          )}
          <ProjectsGrid
            projects={lib.projects}
            onNewProject={() => setNewProjectOpen(true)}
          />
          <StandaloneFilesList
            files={lib.standalone}
            editingSlug={editingSlug}
            onRename={(f, title) => lib.rename(f.slug, title)}
            onMove={setMoving}
            onDelete={setDeleting}
            onEditingEnd={() => setEditingSlug(null)}
            onLabelsUpdated={lib.patchFileLabels}
          />
        </div>
      )}

      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={async (name) => {
          await lib.createProject(name)
        }}
      />

      <MoveToProjectDialog
        open={!!moving}
        fileTitle={moving?.title ?? ''}
        projects={lib.projects}
        currentProjectId={null}
        onClose={() => setMoving(null)}
        onMove={(projectId) => lib.move(moving!.slug, projectId)}
        onNewProject={() => {
          setMoving(null)
          setNewProjectOpen(true)
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        variant='danger'
        testId='jr-delete-dialog'
        confirmTestId='jr-delete-confirm'
        title={`Delete “${deleting?.title ?? ''}”?`}
        description='This removes the file from your account and from this device. Anyone with the share link will lose access. This can’t be undone.'
        confirmLabel='Delete everywhere'
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        <div className='divide-y divide-[var(--jr-border)] rounded-xl border border-[var(--jr-border)] bg-[var(--jr-bg)]'>
          {['Remote copy', 'Copy on this device'].map((label) => (
            <div
              key={label}
              className='flex items-center justify-between px-3 py-2.5 text-[13px]'
            >
              <span className='text-[var(--jr-text-2)]'>{label}</span>
              <span className='font-semibold text-[var(--jr-danger)]'>
                Will be deleted
              </span>
            </div>
          ))}
        </div>
      </ConfirmDialog>
    </main>
  )
}

function LibrarySkeleton() {
  return (
    <div
      className='flex flex-col gap-8'
      aria-busy='true'
      data-testid='library-loading'
    >
      <div className='grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-2 max-sm:grid-cols-1'>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className='h-[150px] animate-pulse rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)]'
          />
        ))}
      </div>
      <div className='h-56 animate-pulse rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)]' />
    </div>
  )
}

function NewProjectDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}) {
  const titleId = useId()
  const inputId = useId()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setName('')
    setError(null)
    onClose()
  }

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give your project a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate(trimmed)
      close()
    } catch (e) {
      setError(errorMessage(e, 'Could not create project'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      labelledBy={titleId}
      dismissible={!busy}
      testId='new-project-dialog'
    >
      <DialogHeader
        id={titleId}
        title='New project'
        description='A shared space for files. Invite people as Editor or Viewer afterwards.'
      />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className='flex flex-col gap-1.5 px-5 pb-2'>
          <label
            htmlFor={inputId}
            className='text-xs font-semibold text-[#334155]'
          >
            Project name
          </label>
          <input
            id={inputId}
            autoFocus
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. API Contracts'
            data-testid='new-project-name'
            className='h-[38px] rounded-[10px] border border-[var(--jr-border)] px-3 text-sm outline-none focus:border-[var(--jr-accent)]'
          />
          {error && (
            <span role='alert' className='text-xs text-[var(--jr-danger)]'>
              {error}
            </span>
          )}
        </div>
        <DialogFooter>
          <Button
            variant='secondary'
            className='h-9 text-[#334155]'
            onClick={close}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            variant='primary'
            className='h-9'
            disabled={busy}
            data-testid='new-project-create'
          >
            {busy ? 'Creating…' : 'Create project'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
