'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogFooter, DialogHeader } from '../ui/dialog'
import { SearchInput } from '../ui/search-input'
import { pluralize } from '@/lib/library-format'
import { projectInitials, projectTone } from '@/lib/project-tone'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/library'

export interface MoveToProjectDialogProps {
  open: boolean
  fileTitle: string
  projects: Project[]
  /** Project the file is currently in (`null` = standalone). */
  currentProjectId: string | null
  onClose: () => void
  onMove: (projectId: string | null) => Promise<void>
  onNewProject?: () => void
}

function describe(p: Project): string {
  if (p.role === 'viewer') return 'Viewer · can’t add files'
  return `${pluralize(p.fileCount, 'file')} · you are ${p.role}`
}

export function MoveToProjectDialog({
  open,
  fileTitle,
  projects,
  currentProjectId,
  onClose,
  onMove,
  onNewProject,
}: MoveToProjectDialogProps) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<string | null>(currentProjectId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTarget(currentProjectId)
      setQuery('')
      setError(null)
    }
  }, [open, currentProjectId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? projects.filter((p) => p.name.toLowerCase().includes(q))
      : projects
  }, [projects, query])

  const showNone =
    !query.trim() || 'no project'.includes(query.trim().toLowerCase())

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onMove(target)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      dismissible={!busy}
      testId='jr-move-dialog'
    >
      <DialogHeader
        id={titleId}
        title={`Move “${fileTitle}”`}
        description='Project members get access according to their role. Link sharing is unchanged.'
      />
      <div className='px-5 pb-2'>
        <SearchInput
          label='Search projects'
          placeholder='Search projects'
          value={query}
          onChange={setQuery}
          className='w-full'
          testId='move-search'
        />
      </div>
      <div
        role='radiogroup'
        aria-label='Destination'
        className='flex max-h-72 flex-col overflow-y-auto px-3 pb-2 pt-1'
      >
        {showNone && (
          <Option
            checked={target === null}
            onSelect={() => setTarget(null)}
            testId='jr-move-option-none'
            tile={<span className='text-[#475569]'>—</span>}
            tileBg='#f1f5f9'
            title='No project'
            subtitle={
              currentProjectId === null ? 'Standalone · current' : 'Standalone'
            }
          />
        )}
        {visible.map((p) => {
          const tone = projectTone(p.id)
          const disabled = p.role === 'viewer'
          return (
            <Option
              key={p.id}
              checked={target === p.id}
              disabled={disabled}
              onSelect={() => setTarget(p.id)}
              testId={`jr-move-option-${p.id}`}
              tile={projectInitials(p.name)}
              tileBg={tone.bg}
              tileFg={tone.fg}
              title={p.name}
              subtitle={
                p.id === currentProjectId
                  ? `${describe(p)} · current`
                  : describe(p)
              }
            />
          )
        })}
        {!showNone && visible.length === 0 && (
          <p className='m-0 px-2 py-4 text-center text-[13px] text-[var(--jr-muted)]'>
            No projects match “{query.trim()}”.
          </p>
        )}
      </div>
      {error && (
        <p
          role='alert'
          className='m-0 px-5 pb-2 text-[13px] text-[var(--jr-danger)]'
        >
          {error}
        </p>
      )}
      <DialogFooter className='justify-between'>
        {onNewProject ? (
          <button
            type='button'
            onClick={onNewProject}
            data-testid='move-new-project'
            className='h-9 cursor-pointer border-0 bg-transparent px-1 text-[13px] font-semibold text-[var(--jr-accent-hover)] hover:underline'
          >
            + New project
          </button>
        ) : (
          <span />
        )}
        <div className='flex gap-2'>
          <Button
            variant='secondary'
            className='h-9 text-[#334155]'
            onClick={onClose}
            disabled={busy}
            data-testid='move-cancel'
          >
            Cancel
          </Button>
          <Button
            variant='primary'
            className='h-9'
            onClick={submit}
            disabled={busy || target === currentProjectId}
            data-testid='move-confirm'
          >
            {busy ? 'Moving…' : 'Move'}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  )
}

function Option({
  checked,
  disabled,
  onSelect,
  tile,
  tileBg,
  tileFg = '#475569',
  title,
  subtitle,
  testId,
}: {
  checked: boolean
  disabled?: boolean
  onSelect: () => void
  tile: React.ReactNode
  tileBg: string
  tileFg?: string
  title: string
  subtitle: string
  testId?: string
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-[10px] px-2 py-2.5',
        disabled
          ? 'cursor-not-allowed opacity-55'
          : 'cursor-pointer hover:bg-[var(--jr-bg)]',
        checked && !disabled && 'bg-[var(--jr-accent-soft)]'
      )}
    >
      <input
        type='radio'
        name='move-target'
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        data-testid={testId}
        className='h-4 w-4 accent-[var(--jr-accent)]'
      />
      <span
        className='flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-xs font-bold'
        style={{ background: tileBg, color: tileFg }}
        title={title}
        aria-label={title}
      >
        {tile}
      </span>
      <span className='flex min-w-0 flex-1 flex-col gap-px'>
        <span className='truncate font-semibold'>{title}</span>
        <span className='text-xs text-[var(--jr-muted)]'>{subtitle}</span>
      </span>
    </label>
  )
}
