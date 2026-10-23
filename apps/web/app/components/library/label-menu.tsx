'use client'

import { Check, Plus, Tag } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/button'
import { LabelPill } from './label-pill'
import { cn } from '@/lib/utils'
import type { FileLabel } from '@/types/library'

const PRESET_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#00B3B7',
  '#f59e0b',
  '#ec4899',
  '#64748b',
]

export interface LabelMenuProps {
  labels: FileLabel[]
  /** Currently selected label ids (filter or assigned). */
  selectedIds: string[]
  onToggle: (id: string) => void
  /** Owner can create custom labels. */
  canCreate?: boolean
  onCreate?: (name: string, color: string) => Promise<void>
  align?: 'start' | 'end'
  /** Trigger button content override. */
  triggerLabel?: ReactNode
  triggerClassName?: string
  testId?: string
  /** Filter mode shows a clear-all when any selected. */
  mode?: 'filter' | 'assign'
  onClear?: () => void
  emptyText?: string
}

/**
 * Multi-select label menu. Stays open while toggling so several labels can
 * be assigned or used as filters in one pass.
 */
export function LabelMenu({
  labels,
  selectedIds,
  onToggle,
  canCreate = false,
  onCreate,
  align = 'end',
  triggerLabel,
  triggerClassName,
  testId = 'label-menu',
  mode = 'filter',
  onClear,
  emptyText = 'No labels yet',
}: LabelMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const selected = new Set(selectedIds)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current
    const menu = menuRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuW = menu?.offsetWidth ?? 240
    const menuH = menu?.offsetHeight ?? 220
    const gap = 6
    const pad = 8

    let left = align === 'end' ? rect.right - menuW : rect.left
    left = Math.min(Math.max(pad, left), window.innerWidth - menuW - pad)

    const below = rect.bottom + gap
    const above = rect.top - gap - menuH
    const fitsBelow = below + menuH <= window.innerHeight - pad
    const top = fitsBelow ? below : Math.max(pad, above)

    setPos({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePosition()
  }, [open, updatePosition, labels.length, creating, selectedIds.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
      setCreating(false)
      setError(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setCreating(false)
        setError(null)
      }
    }
    const onReposition = () => updatePosition()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePosition])

  const submitCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed || !onCreate) return
    setBusy(true)
    setError(null)
    try {
      await onCreate(trimmed, color)
      setName('')
      setCreating(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create label')
    } finally {
      setBusy(false)
    }
  }

  const count = selectedIds.length
  const defaultTrigger =
    mode === 'filter' ? (
      <>
        <Tag size={12} />
        {count > 0 ? `Labels · ${count}` : 'Labels'}
      </>
    ) : (
      <Tag size={16} aria-hidden='true' />
    )

  return (
    <div ref={rootRef} className='relative inline-block'>
      <button
        type='button'
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        className={
          triggerClassName ??
          (mode === 'filter'
            ? 'inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--jr-border)] bg-[var(--jr-surface)] px-2.5 text-xs font-medium text-[var(--jr-text)] transition-colors hover:bg-[var(--jr-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)]'
            : 'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-[#e2e8f0] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] aria-expanded:bg-[#e2e8f0] aria-expanded:text-[var(--jr-text)]')
        }
      >
        {triggerLabel ?? defaultTrigger}
      </button>
      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role='menu'
            data-testid={`${testId}-panel`}
            style={
              pos
                ? { position: 'fixed', top: pos.top, left: pos.left }
                : { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }
            }
            className='z-[200] w-[260px] rounded-xl border border-[var(--jr-border)] bg-[var(--jr-surface)] p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]'
          >
            <div className='px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--jr-muted)]'>
              {mode === 'filter' ? 'Filter by label' : 'Assign labels'}
            </div>

            {labels.length === 0 ? (
              <p className='m-0 px-2.5 py-2 text-sm text-[var(--jr-muted)]'>
                {emptyText}
              </p>
            ) : (
              <ul className='m-0 max-h-[220px] list-none overflow-y-auto p-0'>
                {labels.map((label) => {
                  const on = selected.has(label.id)
                  return (
                    <li key={label.id}>
                      <button
                        type='button'
                        role='menuitemcheckbox'
                        aria-checked={on}
                        data-testid={`${testId}-item-${label.id}`}
                        onClick={() => onToggle(label.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[var(--jr-hover)] focus-visible:bg-[var(--jr-hover)] focus-visible:outline-none'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            on
                              ? 'border-transparent bg-[var(--jr-accent)] text-white'
                              : 'border-[var(--jr-border)] bg-transparent'
                          )}
                        >
                          {on ? <Check size={11} strokeWidth={3} /> : null}
                        </span>
                        <LabelPill label={label} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {mode === 'filter' && count > 0 && onClear ? (
              <button
                type='button'
                onClick={onClear}
                className='mt-0.5 w-full cursor-pointer rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-xs font-medium text-[var(--jr-muted)] hover:bg-[var(--jr-hover)] hover:text-[var(--jr-text)]'
              >
                Clear label filter
              </button>
            ) : null}

            {canCreate && onCreate ? (
              <div className='mt-1 border-t border-[var(--jr-border)] pt-1.5'>
                {creating ? (
                  <div className='flex flex-col gap-2 px-1.5 pb-1'>
                    <input
                      type='text'
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void submitCreate()
                        }
                      }}
                      placeholder='Label name'
                      maxLength={40}
                      autoFocus
                      data-testid={`${testId}-create-name`}
                      className='h-8 w-full rounded-lg border border-[var(--jr-border)] bg-[var(--jr-bg)] px-2.5 text-sm text-[var(--jr-text)] outline-none focus:border-[var(--jr-accent)]'
                    />
                    <div className='flex flex-wrap gap-1.5'>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type='button'
                          aria-label={`Color ${c}`}
                          onClick={() => setColor(c)}
                          className={cn(
                            'h-5 w-5 cursor-pointer rounded-full border-2',
                            color === c
                              ? 'border-[var(--jr-text)]'
                              : 'border-transparent'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    {error ? (
                      <p className='m-0 text-xs text-[var(--jr-danger)]'>
                        {error}
                      </p>
                    ) : null}
                    <div className='flex justify-end gap-1.5'>
                      <Button
                        size='sm'
                        variant='secondary'
                        disabled={busy}
                        onClick={() => {
                          setCreating(false)
                          setError(null)
                          setName('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size='sm'
                        variant='primary'
                        disabled={busy || !name.trim()}
                        data-testid={`${testId}-create-submit`}
                        onClick={() => void submitCreate()}
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type='button'
                    data-testid={`${testId}-create`}
                    onClick={() => setCreating(true)}
                    className='flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-sm font-medium text-[var(--jr-text)] hover:bg-[var(--jr-hover)]'
                  >
                    <Plus size={14} />
                    Create label
                  </button>
                )}
              </div>
            ) : null}
          </div>,
          document.body
        )}
    </div>
  )
}
