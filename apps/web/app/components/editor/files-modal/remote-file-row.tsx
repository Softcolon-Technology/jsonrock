'use client'

import { Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { FileRowMenu } from './file-row-menu'
import { EditableTitle } from '../../library/editable-title'
import { Button, buttonClasses } from '../../ui/button'
import { TypePill } from '../../ui/type-pill'
import { fileHref, formatBytes, formatRelative } from '@/lib/library-format'
import { cn } from '@/lib/utils'
import type { RemoteFile } from '@/types/library'

export interface RemoteFileRowProps {
  file: RemoteFile
  /** The file currently open in the editor. */
  isActive: boolean
  /** A copy of this file also lives in IndexedDB on this device. */
  onDevice: boolean
  /** Show "by <editor>" (project files). */
  inProject: boolean
  onOpen: () => void
  onRename: (file: RemoteFile, title: string) => Promise<void>
  onMove: (file: RemoteFile) => void
  onCopyLink: (file: RemoteFile) => void
  onDelete: (file: RemoteFile) => void
}

function meta(file: RemoteFile, onDevice: boolean, inProject: boolean) {
  const parts: string[] = []
  const when = formatRelative(file.updatedAt)
  const by = inProject ? (file.updatedByMe ? 'you' : file.updatedByName) : null
  parts.push(by ? `${when} by ${by}` : when)
  const bytes = file.sizeBytes ?? file.size
  if (bytes) parts.push(formatBytes(bytes))
  parts.push(
    file.role === 'viewer'
      ? 'read-only for you'
      : onDevice
        ? 'also on this device'
        : 'remote only'
  )
  return parts.filter(Boolean).join(' · ')
}

export function RemoteFileRow({
  file,
  isActive,
  onDevice,
  inProject,
  onOpen,
  onRename,
  onMove,
  onCopyLink,
  onDelete,
}: RemoteFileRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(file.title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canEdit = file.role !== 'viewer'

  const startEdit = () => {
    setDraft(file.title)
    setError(null)
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setError(null)
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
      await onRename(file, next)
      setEditing(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename file')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      data-testid={`jr-file-row-${file.slug}`}
      className={cn(
        'relative flex items-center gap-3.5 border-b border-[var(--jr-border)] px-5 py-4 max-sm:flex-wrap',
        editing && 'bg-[var(--jr-bg)]'
      )}
    >
      <TypePill type={file.type} className='w-12 px-2.5 py-1.5 text-xs' />
      {editing ? (
        <>
          <EditableTitle
            label='File title'
            value={draft}
            onChange={setDraft}
            onSubmit={save}
            onCancel={cancel}
            disabled={saving}
            error={error}
            autoFocus
            testId={`jr-file-rename-input-${file.slug}`}
          />
          <div className='flex items-center gap-1.5'>
            <Button
              size='sm'
              variant='secondary'
              onClick={cancel}
              disabled={saving}
              className='text-[#334155]'
            >
              Cancel
            </Button>
            <Button
              size='sm'
              variant='primary'
              onClick={save}
              disabled={saving}
            >
              Save
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <span className='flex items-center gap-2'>
              <span
                className='truncate text-[15px] font-semibold leading-snug'
                title={file.title}
              >
                {file.title}
              </span>
              {isActive && (
                <span className='shrink-0 rounded-full bg-[var(--jr-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--jr-accent-hover)]'>
                  Open now
                </span>
              )}
            </span>
            <span className='truncate text-[13px] text-[var(--jr-muted)]'>
              {meta(file, onDevice, inProject)}
            </span>
          </div>
          {!isActive && (
            <Link
              href={fileHref(file)}
              target='_blank'
              rel='noopener noreferrer'
              data-testid={`jr-file-open-${file.slug}`}
              onClick={onOpen}
              className={buttonClasses({
                variant: 'secondary',
                size: 'sm',
                className: 'h-9 rounded-[10px] px-3.5 no-underline',
              })}
            >
              Open
            </Link>
          )}
          {canEdit && (
            <button
              type='button'
              aria-label={`Delete ${file.title}`}
              title='Delete'
              data-testid={`jr-row-delete-${file.slug}`}
              onClick={() => onDelete(file)}
              className='inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-red-50 hover:text-[var(--jr-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] dark:hover:bg-red-950/40'
            >
              <Trash2 size={16} aria-hidden='true' />
            </button>
          )}
          <FileRowMenu
            file={file}
            canEdit={canEdit}
            onRename={startEdit}
            onMove={() => onMove(file)}
            onCopyLink={() => onCopyLink(file)}
          />
        </>
      )}
    </div>
  )
}
