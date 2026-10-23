'use client'

import { useAuth, useClerk } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Button, buttonClasses } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { AddExistingFileDialog } from './add-existing-file-dialog'
import { DangerZone } from './danger-zone'
import { PeoplePanel } from './people-panel'
import { ProjectFilesSection } from './project-files-section'
import { ProjectHeader } from './project-header'
import { errorMessage } from '@/hooks/use-library'
import { useProject } from '@/hooks/use-project'
import { listLibrary } from '@/lib/api/files'
import { createRemoteFile } from '@/lib/create-project-file'
import type { DocType, RemoteFile } from '@/types/library'

const SHELL =
  'mx-auto box-border flex w-full max-w-[1200px] flex-col gap-6 px-7 pb-16 pt-7 max-sm:px-4 max-sm:pb-12 max-sm:pt-5'

export function ProjectDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const { getToken } = useAuth()
  const { openSignIn } = useClerk()
  const p = useProject(id)

  const [addOpen, setAddOpen] = useState(false)
  const [standalone, setStandalone] = useState<RemoteFile[]>([])
  const [standaloneLoading, setStandaloneLoading] = useState(false)
  const [movingOut, setMovingOut] = useState<RemoteFile | null>(null)
  const [deleting, setDeleting] = useState<RemoteFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [creatingFile, setCreatingFile] = useState(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const openAdd = useCallback(async () => {
    setAddOpen(true)
    setStandaloneLoading(true)
    try {
      const lib = await listLibrary(getToken)
      setStandalone(lib.standalone ?? [])
    } catch {
      setStandalone([])
    } finally {
      setStandaloneLoading(false)
    }
  }, [getToken])

  if (p.loading) {
    return (
      <main className={SHELL} aria-busy='true' data-testid='project-loading'>
        <div className='h-24 animate-pulse rounded-[14px] bg-[var(--jr-surface)]' />
        <div className='h-72 animate-pulse rounded-[14px] bg-[var(--jr-surface)]' />
      </main>
    )
  }

  if (!p.detail) {
    const unauthorized = p.errorKind === 'unauthorized'
    const notFound = p.errorKind === 'not_found' || p.errorKind === 'forbidden'
    return (
      <main
        className={`${SHELL} min-h-[calc(100vh-60px)] items-center justify-center`}
        data-testid='project-error'
      >
        <div className='flex w-full max-w-md flex-col items-center gap-3 rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-8 py-10 text-center shadow-sm'>
          <h1 className='m-0 text-xl font-bold tracking-tight text-[var(--jr-text)]'>
            {unauthorized
              ? 'Sign in to view this project'
              : notFound
                ? 'Project not found'
                : 'Could not load this project'}
          </h1>
          <p className='m-0 max-w-sm text-sm leading-relaxed text-[var(--jr-muted)]'>
            {unauthorized
              ? 'Your session expired. Sign in again to continue.'
              : notFound
                ? 'It may have been deleted, or you no longer have access.'
                : p.error}
          </p>
          <div className='mt-2 flex flex-wrap items-center justify-center gap-2'>
            {unauthorized ? (
              <Button variant='primary' onClick={() => openSignIn({})}>
                Sign in
              </Button>
            ) : (
              !notFound && (
                <Button variant='secondary' onClick={() => void p.refresh()}>
                  Retry
                </Button>
              )
            )}
            <Link
              href='/workspace'
              className={buttonClasses({
                variant: 'secondary',
                className: 'no-underline',
              })}
            >
              Back to library
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const { project, files, members, invites } = p.detail
  const isOwner = project.role === 'owner'
  const me = members.find((m) => m.isYou)

  const run = async (fn: () => Promise<void>) => {
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError(errorMessage(e, 'Something went wrong'))
    }
  }

  const leave = async () => {
    if (!me) throw new Error('Could not determine your membership')
    await p.remove(me.userId)
    router.push('/workspace')
  }

  const handleNewFile = async (type: DocType) => {
    if (creatingFile) return
    setActionError(null)
    setCreatingFile(true)
    try {
      const { file } = await createRemoteFile(getToken, type, project.id)
      p.prependFile(file)
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

  return (
    <main data-testid='project-detail-page' className={SHELL}>
      <ProjectHeader
        project={project}
        fileCount={files.length}
        memberCount={members.length}
        pendingInviteCount={invites.length}
        onRename={p.rename}
        onAddExisting={() => void openAdd()}
        onNewFile={(type) => void handleNewFile(type)}
        creatingFile={creatingFile}
        onCopyLink={() =>
          void navigator.clipboard?.writeText(window.location.href)
        }
        onLeave={!isOwner ? () => void run(leave) : undefined}
      />

      {actionError && (
        <div
          role='alert'
          className='rounded-xl border border-[#fecaca] bg-[var(--jr-danger-soft)] px-4 py-3 text-sm text-[var(--jr-danger)]'
        >
          {actionError}
        </div>
      )}

      <div className='relative flex flex-col items-stretch gap-6 lg:flex-row lg:items-start'>
        {p.refreshing && (
          <div
            role='status'
            aria-live='polite'
            className='absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 rounded-full border border-[var(--jr-border)] bg-[var(--jr-surface)] px-2.5 py-1 text-xs font-medium text-[var(--jr-muted)] shadow-sm'
          >
            <Loader2 size={12} className='animate-spin' aria-hidden='true' />
            Updating…
          </div>
        )}
        <section className='flex min-w-0 flex-1 flex-col gap-3 lg:min-w-[0]'>
          <ProjectFilesSection
            files={files}
            role={project.role}
            projectId={project.id}
            editingSlug={editingSlug}
            onRename={(f, title) => p.renameFile(f.slug, title)}
            onMoveOut={setMovingOut}
            onDelete={setDeleting}
            onEditingEnd={() => setEditingSlug(null)}
            onLabelsUpdated={p.patchFileLabels}
          />
          {isOwner && (
            <DangerZone
              fileCount={files.length}
              onDelete={async () => {
                await p.destroy()
                router.push('/workspace')
              }}
            />
          )}
        </section>

        <PeoplePanel
          members={members}
          invites={invites}
          isOwner={isOwner}
          onInvite={p.invite}
          onSetRole={p.setRole}
          onRemove={p.remove}
          onRevoke={p.revoke}
          onLeave={leave}
        />
      </div>

      <AddExistingFileDialog
        open={addOpen}
        projectName={project.name}
        files={standalone}
        loading={standaloneLoading}
        onClose={() => setAddOpen(false)}
        onAdd={async (slugs) => {
          for (const slug of slugs) await p.moveFile(slug, project.id)
        }}
      />

      <ConfirmDialog
        open={!!movingOut}
        testId='move-out-dialog'
        title={`Move “${movingOut?.title ?? ''}” out of this project?`}
        description='It becomes a standalone file in your library. Project members lose access to it. Link sharing is unchanged.'
        confirmLabel='Move out'
        busy={busy}
        onCancel={() => setMovingOut(null)}
        onConfirm={async () => {
          if (!movingOut) return
          setBusy(true)
          await run(() => p.moveFile(movingOut.slug, null))
          setBusy(false)
          setMovingOut(null)
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
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          setBusy(true)
          await run(() => p.removeFile(deleting.slug))
          setBusy(false)
          setDeleting(null)
        }}
      />
    </main>
  )
}
