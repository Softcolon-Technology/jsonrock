'use client'

import { useAuth, useClerk } from '@clerk/nextjs'
import { X } from 'lucide-react'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import LocalHistoryModal from '../local-history-modal'
import { RemoteFilesTab } from './remote-files-tab'
import { MoveToProjectDialog } from '../../projects/move-to-project-dialog'
import { ConfirmDialog } from '../../ui/confirm-dialog'
import { Dialog } from '../../ui/dialog'
import { SearchInput } from '../../ui/search-input'
import { SegmentedControl } from '../../ui/segmented-control'
import { getEditorBasePath } from '@/app/iterface'
import { errorMessage } from '@/hooks/use-library'
import { useRemoteLibrary } from '@/hooks/use-remote-file'
import { buildViewOnlyShareUrl } from '@/lib/api/share-link'
import { writeClipboardText } from '@/lib/clipboard'
import { pluralize } from '@/lib/library-format'
import { deleteLocalDocument } from '@/lib/local-docs'
import type { RemoteFile } from '@/types/library'

type TabId = 'remote' | 'device'

/** Same props as LocalHistoryModal — the "This device" tab renders it embedded. */
export type FilesModalProps = Omit<
  ComponentProps<typeof LocalHistoryModal>,
  'variant' | 'searchQuery'
>

export function FilesModal(props: FilesModalProps) {
  const {
    isOpen,
    onClose,
    documents,
    activeSlug,
    onDeleteDocument,
    onClearAll,
    onRenameDocument,
  } = props
  const titleId = useId()
  const { getToken, isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const library = useRemoteLibrary(isOpen)

  const [tab, setTab] = useState<TabId>('device')
  const [query, setQuery] = useState('')
  const [moving, setMoving] = useState<RemoteFile | null>(null)
  const [deleting, setDeleting] = useState<RemoteFile | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fresh state each time the modal opens; default to Remote when signed in.
  const pickedTab = useRef(false)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      pickedTab.current = false
      setQuery('')
      setNotice(null)
    }
    wasOpen.current = isOpen
    // Auth may resolve just after opening — follow it until the user picks a tab.
    if (isOpen && !pickedTab.current) setTab(isSignedIn ? 'remote' : 'device')
  }, [isOpen, isSignedIn])

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    []
  )

  const flash = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 2500)
  }, [])

  const localSlugs = useMemo(
    () => new Set(documents.map((d) => d.slug)),
    [documents]
  )
  const remoteCount =
    library.standalone.length +
    library.groups.reduce((n, g) => n + g.files.length, 0)

  const handleRename = useCallback(
    async (file: RemoteFile, title: string) => {
      await library.rename(file.slug, title)
      // Keep the IndexedDB title in step (also refreshes the device list).
      if (localSlugs.has(file.slug)) await onRenameDocument(file.slug, title)
    },
    [library, localSlugs, onRenameDocument]
  )

  const handleCopyLink = useCallback(
    async (file: RemoteFile) => {
      try {
        const url = await buildViewOnlyShareUrl(getToken, {
          slug: file.slug,
          type: file.type,
          passwordProtected:
            file.passwordProtected || file.shareMode === 'password',
        })
        await writeClipboardText(url)
        flash('View-only link copied')
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Could not copy share link')
      }
    },
    [flash, getToken]
  )

  /** Remote first; the IndexedDB copy is only touched once the server accepted it. */
  const confirmDelete = async () => {
    if (!deleting) return
    const file = deleting
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await library.remove(file.slug)
    } catch (e) {
      setDeleteError(errorMessage(e, 'Could not delete the remote file'))
      setDeleteBusy(false)
      return
    }
    try {
      await deleteLocalDocument(file.slug)
      if (localSlugs.has(file.slug)) await onDeleteDocument(file.slug)
    } catch (e) {
      console.error('Failed to delete local copy', e)
    }
    setDeleteBusy(false)
    setDeleting(null)
    if (file.slug === activeSlug) {
      // The open document no longer exists anywhere — leave it.
      window.location.assign(getEditorBasePath(file.type))
    }
  }

  const confirmClear = async () => {
    setClearBusy(true)
    try {
      await onClearAll()
      setClearing(false)
    } finally {
      setClearBusy(false)
    }
  }

  const overlayOpen = !!moving || !!deleting || clearing

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={onClose}
        labelledBy={titleId}
        dismissible={!overlayOpen}
        testId='jr-files-modal'
        className='max-h-[85vh] max-w-[820px] rounded-[18px] shadow-[0_24px_64px_rgba(15,23,42,0.28)]'
      >
        <div className='flex flex-col gap-3.5 border-b border-[var(--jr-border)] px-5 pb-3.5 pt-[18px]'>
          <div className='flex items-center justify-between gap-3'>
            <h2 id={titleId} className='m-0 text-[17px] font-bold'>
              Files
            </h2>
            <button
              type='button'
              aria-label='Close'
              onClick={onClose}
              className='inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-[var(--jr-hover)] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)]'
            >
              <X size={18} />
            </button>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <SegmentedControl<TabId>
              ariaLabel='File source'
              value={tab}
              onChange={(next) => {
                pickedTab.current = true
                setTab(next)
              }}
              options={[
                {
                  value: 'remote',
                  label: 'Remote',
                  count: isSignedIn ? remoteCount : undefined,
                  testId: 'jr-files-tab-remote',
                },
                {
                  value: 'device',
                  label: 'This device',
                  count: documents.length,
                  testId: 'jr-files-tab-device',
                },
              ]}
            />
            <SearchInput
              label={
                tab === 'remote' ? 'Search remote files' : 'Search this device'
              }
              placeholder={
                tab === 'remote'
                  ? 'Search by title'
                  : 'Search by slug, title, or preview'
              }
              value={query}
              onChange={setQuery}
              className='h-[34px] w-[260px] max-sm:w-full'
              testId='jr-files-search'
            />
          </div>
        </div>

        <div className='min-h-[260px] flex-1 overflow-y-auto'>
          {tab === 'remote' ? (
            <RemoteFilesTab
              library={library}
              loading={library.loading}
              error={library.error}
              isSignedIn={!!isSignedIn}
              query={query}
              activeSlug={activeSlug}
              localSlugs={localSlugs}
              onRetry={() => void library.refresh(true)}
              onSignIn={() => openSignIn()}
              onOpenFile={onClose}
              onRename={handleRename}
              onMove={setMoving}
              onCopyLink={(f) => void handleCopyLink(f)}
              onDelete={(f) => {
                setDeleteError(null)
                setDeleting(f)
              }}
            />
          ) : (
            <LocalHistoryModal
              {...props}
              variant='embedded'
              searchQuery={query}
              onClearAll={() => setClearing(true)}
            />
          )}
        </div>

        <div className='flex items-center justify-between gap-3 border-t border-[var(--jr-border)] bg-[var(--jr-bg)] px-5 py-3'>
          <span role='status' className='text-xs text-[var(--jr-muted)]'>
            {notice ?? ''}
          </span>
          <Link
            href='/workspace'
            onClick={onClose}
            className='shrink-0 whitespace-nowrap text-[13px] font-semibold text-[var(--jr-accent-hover)] no-underline hover:underline'
          >
            Manage in Workspace
          </Link>
        </div>
      </Dialog>

      <MoveToProjectDialog
        open={!!moving}
        fileTitle={moving?.title ?? ''}
        projects={library.projects}
        currentProjectId={moving?.projectId ?? null}
        onClose={() => setMoving(null)}
        onMove={async (projectId) => {
          if (moving) await library.move(moving.slug, projectId)
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        variant='danger'
        title={`Delete “${deleting?.title ?? ''}” everywhere?`}
        description='This permanently deletes the remote file and the copy on this device. Anyone with access loses it. This can’t be undone.'
        confirmLabel='Delete everywhere'
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
        testId='jr-delete-dialog'
        confirmTestId='jr-delete-confirm'
      >
        {deleteError && (
          <p role='alert' className='m-0 text-[13px] text-[var(--jr-danger)]'>
            {deleteError} — nothing was deleted.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={clearing}
        variant='danger'
        title='Clear this device’s history?'
        description={`This removes ${pluralize(documents.length, 'file')} stored in this browser. Remote files are never deleted.`}
        confirmLabel='Clear history'
        busy={clearBusy}
        onConfirm={() => void confirmClear()}
        onCancel={() => setClearing(false)}
        testId='jr-clear-device-dialog'
      />
    </>
  )
}
