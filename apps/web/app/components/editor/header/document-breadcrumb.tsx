'use client'

import { FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ShareType } from '@/app/iterface'
import { DOCUMENT_TITLE_MAX_LENGTH } from '@/lib/local-docs'
import { cn } from '@/lib/utils'

export interface DocumentBreadcrumbProps {
  documentType: ShareType
  title: string
  /** Persist a new title. Reject to show an error and revert the draft. */
  onRename?: (title: string) => Promise<void>
  /** Title is editable. */
  canRename: boolean
  isAutoSaving: boolean
  /** When false, show “Unsaved” instead of “Saved”. */
  isPersisted?: boolean
  /** Focus + select the title once (e.g. right after New file). */
  autoFocusRename?: boolean
  projectId?: string | null
  projectName?: string | null
}

const TYPE_LABEL: Record<ShareType, string> = {
  json: 'JSON',
  text: 'TEXT',
  markdown: 'MD',
  html: 'HTML',
}

const TYPE_STYLE: Record<ShareType, string> = {
  json: 'bg-[#ecfdf5] text-[#047857] dark:bg-emerald-950/40 dark:text-emerald-400',
  text: 'bg-[#f1f5f9] text-[#334155] dark:bg-zinc-800 dark:text-zinc-300',
  markdown:
    'bg-[#f5f3ff] text-[#6d28d9] dark:bg-violet-950/40 dark:text-violet-300',
  html: 'bg-[#fff7ed] text-[#c2410c] dark:bg-orange-950/40 dark:text-orange-300',
}

/** `[project chip] / [title input] [TYPE] ● Saved` — screen.html frame 04. */
export function DocumentBreadcrumb({
  documentType,
  title,
  onRename,
  canRename,
  isAutoSaving,
  isPersisted = true,
  autoFocusRename = false,
  projectId,
  projectName,
}: DocumentBreadcrumbProps) {
  const [draft, setDraft] = useState(title)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const didAutoFocus = useRef(false)

  useEffect(() => {
    setDraft(title)
  }, [title])

  useEffect(() => {
    if (!autoFocusRename || !canRename || didAutoFocus.current) return
    didAutoFocus.current = true
    const id = window.setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.select()
    }, 50)
    return () => window.clearTimeout(id)
  }, [autoFocusRename, canRename])

  const readOnly = !canRename || !onRename

  const commit = async () => {
    const next = draft.trim()
    if (readOnly || !next || next === title) {
      setDraft(title)
      setError(null)
      return
    }
    try {
      await onRename?.(next)
      setError(null)
    } catch (e) {
      setDraft(title)
      setError(e instanceof Error ? e.message : 'Could not rename')
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(title)
      setError(null)
      e.currentTarget.blur()
    }
  }

  const statusLabel = isAutoSaving
    ? 'Saving…'
    : isPersisted
      ? 'Saved'
      : 'Unsaved'

  return (
    <div
      data-testid='jr-breadcrumb'
      className='flex h-7 min-w-0 items-center gap-2 border-l border-[var(--jr-border)] pl-3 sm:pl-5 dark:border-zinc-800'
    >
      {projectId && projectName ? (
        <>
          <Link
            href={`/workspace/projects/${encodeURIComponent(projectId)}`}
            data-testid='jr-project-chip'
            title={`Open project “${projectName}”`}
            className='inline-flex max-w-[160px] items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-[var(--jr-muted)] no-underline hover:text-[var(--jr-text)] max-sm:hidden dark:text-zinc-400 dark:hover:text-zinc-100'
          >
            <FolderOpen size={14} aria-hidden='true' className='shrink-0' />
            <span className='truncate'>{projectName}</span>
          </Link>
          <span
            aria-hidden='true'
            className='text-sm text-[#cbd5e1] max-sm:hidden dark:text-zinc-700'
          >
            /
          </span>
        </>
      ) : null}
      <label htmlFor='jr-title-input' className='sr-only'>
        Document title
      </label>
      <input
        ref={inputRef}
        id='jr-title-input'
        data-testid='jr-title-input'
        type='text'
        value={draft}
        maxLength={DOCUMENT_TITLE_MAX_LENGTH}
        readOnly={readOnly}
        placeholder={readOnly ? undefined : 'Name this file'}
        aria-invalid={error ? true : undefined}
        title={
          error ??
          (readOnly
            ? 'Save the document before renaming'
            : 'Click to rename — press Enter or click away to save')
        }
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (!readOnly) e.currentTarget.select()
        }}
        className={cn(
          '-ml-1.5 w-[min(240px,28vw)] min-w-[7rem] max-w-[280px] flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-[var(--jr-text)] outline-none dark:text-zinc-100',
          !readOnly &&
            'cursor-text hover:border-[var(--jr-border)] focus:border-[var(--jr-accent)] focus:bg-[var(--jr-bg)] dark:hover:border-zinc-700 dark:focus:bg-zinc-900',
          readOnly && 'cursor-default text-[var(--jr-muted)]',
          error && 'border-[var(--jr-danger)]'
        )}
      />
      <span
        className={cn(
          'shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.04em]',
          TYPE_STYLE[documentType]
        )}
      >
        {TYPE_LABEL[documentType]}
      </span>
      <span
        role='status'
        className='ml-1 inline-flex items-center gap-[5px] whitespace-nowrap text-xs text-[var(--jr-muted-2)] max-md:hidden'
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isAutoSaving
              ? 'animate-pulse bg-amber-500'
              : isPersisted
                ? 'bg-[var(--jr-accent)]'
                : 'bg-zinc-300 dark:bg-zinc-600'
          )}
        />
        {statusLabel}
      </span>
      {error && (
        <span role='alert' className='sr-only'>
          {error}
        </span>
      )}
    </div>
  )
}
