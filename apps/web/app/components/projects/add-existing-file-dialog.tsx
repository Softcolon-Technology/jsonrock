'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogFooter, DialogHeader } from '../ui/dialog'
import { SearchInput } from '../ui/search-input'
import { TypePill } from '../ui/type-pill'
import { formatRelative } from '@/lib/library-format'
import type { RemoteFile } from '@/types/library'

export interface AddExistingFileDialogProps {
  open: boolean
  projectName: string
  /** Standalone files that can be added. */
  files: RemoteFile[]
  loading?: boolean
  onClose: () => void
  onAdd: (slugs: string[]) => Promise<void>
}

export function AddExistingFileDialog({
  open,
  projectName,
  files,
  loading,
  onClose,
  onAdd,
}: AddExistingFileDialogProps) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(new Set())
      setError(null)
    }
  }, [open])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? files.filter((f) => f.title.toLowerCase().includes(q)) : files
  }, [files, query])

  const toggle = (slug: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onAdd([...selected])
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add files')
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
      testId='add-existing-file-dialog'
    >
      <DialogHeader
        id={titleId}
        title={`Add existing file to ${projectName}`}
        description='Choose standalone files to move into this project. Members get access according to their role.'
      />
      <div className='px-5 pb-2'>
        <SearchInput
          label='Search files'
          placeholder='Search standalone files'
          value={query}
          onChange={setQuery}
          className='w-full'
          testId='add-existing-search'
        />
      </div>
      <div className='flex max-h-72 flex-col overflow-y-auto px-3 pb-2 pt-1'>
        {loading ? (
          <p className='m-0 px-2 py-6 text-center text-[13px] text-[var(--jr-muted)]'>
            Loading files…
          </p>
        ) : visible.length === 0 ? (
          <p className='m-0 px-2 py-6 text-center text-[13px] text-[var(--jr-muted)]'>
            {files.length === 0
              ? 'No standalone files to add.'
              : `No files match “${query.trim()}”.`}
          </p>
        ) : (
          visible.map((f) => (
            <label
              key={f.slug}
              className='flex cursor-pointer items-center gap-3 rounded-[10px] px-2 py-2.5 hover:bg-[var(--jr-bg)]'
            >
              <input
                type='checkbox'
                checked={selected.has(f.slug)}
                onChange={() => toggle(f.slug)}
                data-testid='add-existing-option'
                className='h-4 w-4 accent-[var(--jr-accent)]'
              />
              <TypePill type={f.type} />
              <span className='flex min-w-0 flex-1 flex-col gap-px'>
                <span className='truncate font-semibold'>{f.title}</span>
                <span className='text-xs text-[var(--jr-muted)]'>
                  Edited {formatRelative(f.updatedAt)}
                </span>
              </span>
            </label>
          ))
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
      <DialogFooter>
        <Button
          variant='secondary'
          className='h-9 text-[#334155]'
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          variant='primary'
          className='h-9'
          onClick={submit}
          disabled={busy || selected.size === 0}
          data-testid='add-existing-confirm'
        >
          {busy
            ? 'Adding…'
            : selected.size > 0
              ? `Add ${selected.size} ${selected.size === 1 ? 'file' : 'files'}`
              : 'Add'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
