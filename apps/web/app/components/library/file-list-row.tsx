'use client'

import { useAuth } from '@clerk/nextjs'
import {
  Check,
  FolderInput,
  FolderOutput,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TypePill } from '../ui/type-pill'
import { Button } from '../ui/button'
import { DropdownMenu, type DropdownMenuItem } from '../ui/dropdown-menu'
import { EditableTitle } from './editable-title'
import { LabelMenu } from './label-menu'
import { LabelPill } from './label-pill'
import { Toast } from '../ui/Toast'
import { buildViewOnlyShareUrl } from '@/lib/api/share-link'
import { writeClipboardText } from '@/lib/clipboard'
import { fileHref, fileMeta } from '@/lib/library-format'
import { cn } from '@/lib/utils'
import type { FileLabel, RemoteFile } from '@/types/library'

export interface FileListRowProps {
  file: RemoteFile
  /** `project` rows show "by <editor>" and a "Move out of project" action. */
  context?: 'library' | 'project'
  /** Rename / move are allowed (owner or editor). */
  canEdit?: boolean
  canDelete?: boolean
  /** Start in rename mode (e.g. right after "New file in project"). */
  initialEditing?: boolean
  onRename?: (file: RemoteFile, title: string) => Promise<void>
  onMove?: (file: RemoteFile) => void
  onDelete?: (file: RemoteFile) => void
  /** Called after rename succeeds or is cancelled when `initialEditing` was set. */
  onEditingEnd?: () => void
  /** Catalog of labels available for this file's scope. */
  availableLabels?: FileLabel[]
  /** Replace assigned labels (multi-assign). */
  onLabelsChange?: (file: RemoteFile, labelIds: string[]) => Promise<void>
  canCreateLabel?: boolean
  onCreateLabel?: (name: string, color: string) => Promise<void>
}

export function FileListRow({
  file,
  context = 'library',
  canEdit = true,
  canDelete = canEdit,
  initialEditing = false,
  onRename,
  onMove,
  onDelete,
  onEditingEnd,
  availableLabels = [],
  onLabelsChange,
  canCreateLabel = false,
  onCreateLabel,
}: FileListRowProps) {
  const { getToken } = useAuth()
  const [editing, setEditing] = useState(initialEditing)
  const [draft, setDraft] = useState(file.title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labelBusy, setLabelBusy] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'busy' | 'copied'>(
    'idle'
  )
  const [shareToast, setShareToast] = useState<string | null>(null)

  const assigned = file.labels ?? []
  const assignedIds = assigned.map((l) => l.id)
  const canAssignLabels = Boolean(canEdit && onLabelsChange)

  const copyShareLink = async () => {
    if (shareState === 'busy') return
    setShareState('busy')
    setShareToast(null)
    try {
      const url = await buildViewOnlyShareUrl(getToken, {
        slug: file.slug,
        type: file.type,
        passwordProtected:
          file.passwordProtected || file.shareMode === 'password',
      })
      try {
        await writeClipboardText(url)
        setShareState('copied')
        setShareToast('View-only link copied')
      } catch {
        // Clipboard blocked (unfocused tab, permissions) — offer manual copy.
        window.prompt('Copy this view-only link:', url)
        setShareState('copied')
        setShareToast('View-only link ready to copy')
      }
      window.setTimeout(() => {
        setShareState('idle')
        setShareToast(null)
      }, 2200)
    } catch (e) {
      setShareState('idle')
      setShareToast(
        e instanceof Error
          ? e.message
          : 'Could not build a share link for this file.'
      )
      window.setTimeout(() => setShareToast(null), 4000)
    }
  }

  const toggleLabel = async (id: string) => {
    if (!onLabelsChange || labelBusy) return
    const next = assignedIds.includes(id)
      ? assignedIds.filter((x) => x !== id)
      : [...assignedIds, id]
    setLabelBusy(true)
    try {
      await onLabelsChange(file, next)
    } finally {
      setLabelBusy(false)
    }
  }

  useEffect(() => {
    if (!editing) setDraft(file.title)
  }, [file.title, editing])

  useEffect(() => {
    if (!initialEditing) return
    setDraft(file.title)
    setError(null)
    setEditing(true)
    // Only enter rename mode when this slug is selected — don't reset draft on remote title sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit file.title
  }, [initialEditing, file.slug])

  const inProject = context === 'project'

  const startEdit = () => {
    setDraft(file.title)
    setError(null)
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setError(null)
    onEditingEnd?.()
  }
  const save = async () => {
    const next = draft.trim()
    if (!next) {
      setError('Title can’t be empty')
      return
    }
    if (next === file.title) return cancel()
    setSaving(true)
    try {
      await onRename?.(file, next)
      setEditing(false)
      setError(null)
      onEditingEnd?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename file')
    } finally {
      setSaving(false)
    }
  }

  // Delete stays outside the ··· menu as a dedicated control.
  const menuItems: DropdownMenuItem[] = [
    ...(canEdit && onRename
      ? [
          {
            key: 'rename',
            label: 'Rename',
            icon: <Pencil size={15} />,
            onSelect: startEdit,
            testId: `jr-row-rename-${file.slug}`,
          },
        ]
      : []),
    ...(canEdit && onMove
      ? [
          {
            key: 'move',
            label: inProject ? 'Move out of project' : 'Move to project…',
            icon: inProject ? (
              <FolderOutput size={15} />
            ) : (
              <FolderInput size={15} />
            ),
            onSelect: () => onMove(file),
            testId: `jr-row-move-${file.slug}`,
          },
        ]
      : []),
  ]
  const showOverflow = menuItems.length > 0
  const showDelete = Boolean(canDelete && onDelete)

  return (
    <>
      <tr
        data-testid='file-row'
        data-slug={file.slug}
        className={cn(
          'border-b border-[var(--jr-border)] last:border-b-0',
          'max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-2 max-sm:px-3 max-sm:py-3',
          editing && 'bg-[var(--jr-bg)]'
        )}
      >
        {editing ? (
          <td
            colSpan={3}
            className='px-4 py-3 max-sm:flex max-sm:w-full max-sm:flex-col max-sm:gap-2 max-sm:p-0'
          >
            <div className='flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3.5'>
              <div className='flex min-w-0 items-center gap-3'>
                <TypePill type={file.type} />
                <EditableTitle
                  label='File title'
                  value={draft}
                  onChange={setDraft}
                  onSubmit={save}
                  onCancel={cancel}
                  disabled={saving}
                  error={error}
                  autoFocus
                  testId='file-rename-input'
                />
              </div>
              <div className='flex shrink-0 items-center gap-1.5 max-sm:w-full max-sm:justify-end sm:ml-auto'>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={cancel}
                  disabled={saving}
                  className='text-[#334155]'
                  data-testid='file-rename-cancel'
                >
                  Cancel
                </Button>
                <Button
                  size='sm'
                  variant='primary'
                  onClick={save}
                  disabled={saving}
                  data-testid='file-rename-save'
                >
                  Save
                </Button>
              </div>
            </div>
          </td>
        ) : (
          <>
            <td className='w-14 whitespace-nowrap px-4 py-3 align-middle max-sm:w-auto max-sm:p-0'>
              <TypePill type={file.type} />
            </td>
            <td className='min-w-0 px-0 py-3 align-middle max-sm:min-w-0 max-sm:flex-1 max-sm:p-0 sm:px-2'>
              <div className='flex min-w-0 flex-col gap-0.5'>
                <Link
                  href={fileHref(file)}
                  target='_blank'
                  rel='noopener noreferrer'
                  data-testid='file-title'
                  className='truncate text-sm font-semibold text-[var(--jr-text)] no-underline hover:text-[var(--jr-accent-hover)]'
                >
                  {file.title}
                </Link>
                <span className='truncate text-xs text-[var(--jr-muted)]'>
                  {fileMeta(file, { project: inProject })}
                </span>
                {assigned.length > 0 ? (
                  <div
                    className='mt-1 flex flex-wrap gap-1'
                    data-testid={`jr-file-labels-${file.slug}`}
                  >
                    {assigned.map((label) => (
                      <LabelPill key={label.id} label={label} />
                    ))}
                  </div>
                ) : null}
              </div>
            </td>
            <td className='whitespace-nowrap px-2 py-3 text-right align-middle max-sm:ml-auto max-sm:w-auto max-sm:p-0'>
              <div className='inline-flex items-center justify-end gap-0.5'>
                <button
                  type='button'
                  aria-label={`Copy view-only share link for ${file.title}`}
                  title={
                    shareState === 'copied'
                      ? 'Copied view-only link'
                      : 'Copy view-only share link'
                  }
                  data-testid={`jr-row-share-${file.slug}`}
                  disabled={shareState === 'busy'}
                  onClick={() => void copyShareLink()}
                  className={cn(
                    'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] disabled:cursor-wait',
                    shareState === 'copied'
                      ? 'text-[var(--jr-accent)]'
                      : 'text-[var(--jr-muted)] hover:bg-[#e2e8f0] hover:text-[var(--jr-text)]'
                  )}
                >
                  {shareState === 'copied' ? (
                    <Check size={16} aria-hidden='true' />
                  ) : (
                    <Link2 size={16} aria-hidden='true' />
                  )}
                </button>
                {canAssignLabels && (
                  <LabelMenu
                    mode='assign'
                    labels={availableLabels}
                    selectedIds={assignedIds}
                    onToggle={(id) => void toggleLabel(id)}
                    canCreate={canCreateLabel}
                    onCreate={onCreateLabel}
                    testId={`jr-file-labels-menu-${file.slug}`}
                    triggerClassName={cn(
                      'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-[#e2e8f0] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)]',
                      assigned.length > 0 && 'text-[var(--jr-accent-hover)]'
                    )}
                  />
                )}
                {showDelete && (
                  <button
                    type='button'
                    aria-label={`Delete ${file.title}`}
                    title='Delete'
                    data-testid={`jr-row-delete-${file.slug}`}
                    onClick={() => onDelete?.(file)}
                    className='inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-red-50 hover:text-[var(--jr-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] dark:hover:bg-red-950/40'
                  >
                    <Trash2 size={16} aria-hidden='true' />
                  </button>
                )}
                {showOverflow && (
                  <DropdownMenu
                    items={menuItems}
                    align='end'
                    menuClassName='w-[220px]'
                    menuTestId={`jr-file-row-menu-panel-${file.slug}`}
                    renderTrigger={(trigger) => (
                      <button
                        type='button'
                        {...trigger}
                        aria-label={`More actions for ${file.title}`}
                        title='More actions'
                        data-testid={`jr-file-row-menu-${file.slug}`}
                        className='inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-[#e2e8f0] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] aria-expanded:bg-[#e2e8f0] aria-expanded:text-[var(--jr-text)]'
                      >
                        <MoreHorizontal size={18} aria-hidden='true' />
                      </button>
                    )}
                  />
                )}
              </div>
            </td>
          </>
        )}
      </tr>
      {typeof document !== 'undefined'
        ? createPortal(
            <Toast
              isOpen={Boolean(shareToast)}
              message={shareToast ?? ''}
              onClose={() => setShareToast(null)}
              duration={shareState === 'copied' ? 2200 : 4000}
            />,
            document.body
          )
        : null}
    </>
  )
}
