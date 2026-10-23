'use client'

import { ChevronDown, Loader2, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface NewMenuItem {
  id: string
  label: string
  href: string
  icon: ReactNode
}

export interface NewDocumentMenuProps {
  /** Existing header navigation targets (JSON / Text / Markdown / HTML / Diff). */
  items: NewMenuItem[]
  /** id of the item the primary "New" button opens (current document type). */
  primaryId: string
  /** Fallback navigation (signed out, or Diff). */
  onNavigate: (href: string) => void
  /**
   * Signed-in create: build a real Library file then open it (with rename focus).
   * Return the URL to navigate to, or null to fall back to onNavigate.
   */
  onCreateFile?: (item: NewMenuItem) => Promise<string | null>
  /** Current document's project; enables the "Save into …" checkbox. */
  projectId?: string | null
  projectName?: string | null
  saveIntoProject: boolean
  onSaveIntoProjectChange: (next: boolean) => void
}

const btnBase =
  'h-9 cursor-pointer border-0 bg-[var(--jr-accent)] text-white transition-colors hover:bg-[var(--jr-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 disabled:cursor-wait disabled:opacity-80'

/** Green split button: `New` (current type) + chevron menu of document types. */
export function NewDocumentMenu({
  items,
  primaryId,
  onNavigate,
  onCreateFile,
  projectId,
  projectName,
  saveIntoProject,
  onSaveIntoProjectChange,
}: NewDocumentMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = async (item: NewMenuItem) => {
    setOpen(false)
    if (busy) return

    // Diff is not a Library file.
    if (item.id === 'diff' || !onCreateFile) {
      const intoProject = saveIntoProject && projectId && item.id !== 'diff'
      onNavigate(
        intoProject
          ? `${item.href}?projectId=${encodeURIComponent(projectId)}`
          : item.href
      )
      return
    }

    setBusy(true)
    try {
      const url = await onCreateFile(item)
      if (url) {
        onNavigate(url)
        return
      }
      const intoProject = saveIntoProject && projectId
      onNavigate(
        intoProject
          ? `${item.href}?projectId=${encodeURIComponent(projectId)}`
          : item.href
      )
    } catch {
      const intoProject = saveIntoProject && projectId
      onNavigate(
        intoProject
          ? `${item.href}?projectId=${encodeURIComponent(projectId)}`
          : item.href
      )
    } finally {
      setBusy(false)
    }
  }

  const primary = items.find((i) => i.id === primaryId) ?? items[0]

  return (
    <div ref={rootRef} className='relative inline-flex'>
      <button
        type='button'
        disabled={busy}
        onClick={() => primary && void go(primary)}
        className={cn(
          btnBase,
          'inline-flex items-center gap-[7px] rounded-l-[10px] pl-3.5 pr-3 text-[13px] font-semibold max-sm:px-2.5'
        )}
        title='New document'
      >
        {busy ? (
          <Loader2 size={15} className='animate-spin' aria-hidden='true' />
        ) : (
          <Plus size={15} aria-hidden='true' />
        )}
        <span className='max-sm:hidden'>New</span>
      </button>
      <button
        type='button'
        disabled={busy}
        data-testid='jr-new-split'
        aria-label='Choose document type'
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          btnBase,
          'inline-flex w-[30px] items-center justify-center rounded-r-[10px] border-l border-l-white/30'
        )}
      >
        <ChevronDown
          size={15}
          aria-hidden='true'
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          id={menuId}
          role='menu'
          data-testid='jr-new-menu'
          className='absolute right-0 top-11 z-[60] flex w-[264px] flex-col rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-1.5 text-[var(--jr-text)] shadow-[0_16px_40px_rgba(15,23,42,0.16)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
        >
          <div className='px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--jr-muted-2)]'>
            Create new
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              type='button'
              role='menuitem'
              data-testid={`jr-new-item-${item.id}`}
              onClick={() => void go(item)}
              className={cn(
                'flex h-10 cursor-pointer items-center gap-2.5 rounded-[9px] border-0 bg-transparent px-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--jr-hover)] focus-visible:bg-[var(--jr-hover)] focus-visible:outline-none dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900',
                item.id === primaryId && 'bg-[var(--jr-bg)] dark:bg-zinc-900'
              )}
            >
              <span className='inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[var(--jr-accent-soft)] text-[var(--jr-accent-hover)] dark:bg-emerald-950/40 dark:text-emerald-400'>
                {item.icon}
              </span>
              <span className='flex-1'>{item.label}</span>
            </button>
          ))}
          {projectId && projectName ? (
            <label className='mx-1 mt-1.5 flex cursor-pointer items-start gap-2.5 border-t border-[var(--jr-border)] px-1.5 pb-1.5 pt-2.5 dark:border-zinc-800'>
              <input
                type='checkbox'
                data-testid='jr-save-into-project'
                checked={saveIntoProject}
                onChange={(e) => onSaveIntoProjectChange(e.target.checked)}
                className='mt-0.5 h-4 w-4 accent-[var(--jr-accent)]'
              />
              <span className='flex min-w-0 flex-col gap-px'>
                <span className='truncate text-[13px] font-semibold'>
                  Save into {projectName}
                </span>
                <span className='text-xs text-[var(--jr-muted)]'>
                  Off = standalone remote file
                </span>
              </span>
            </label>
          ) : null}
        </div>
      )}
    </div>
  )
}
