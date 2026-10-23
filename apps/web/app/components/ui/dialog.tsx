'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DialogProps {
  open: boolean
  onClose: () => void
  /** id of the heading element inside the dialog. */
  labelledBy: string
  describedBy?: string
  role?: 'dialog' | 'alertdialog'
  /** Close when the scrim is clicked / Escape is pressed. Default true. */
  dismissible?: boolean
  children: ReactNode
  className?: string
  testId?: string
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Generic modal shell: scrim + 16px rounded surface, Esc / scrim to close, focus trap. */
export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  dismissible = true,
  children,
  className,
  testId,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) return
      const firstNode = nodes[0]!
      const lastNode = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault()
        lastNode.focus()
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault()
        firstNode.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [open, dismissible])

  if (!open) return null

  return (
    <div
      className='fixed inset-0 z-[100] box-border flex items-center justify-center bg-[rgba(15,23,42,0.38)] p-6 max-sm:items-end max-sm:p-2'
      role='presentation'
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal='true'
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        data-testid={testId}
        className={cn(
          'flex max-h-full w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-[var(--jr-surface)] text-[var(--jr-text)] shadow-[0_24px_64px_rgba(15,23,42,0.22)] outline-none',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({
  id,
  title,
  description,
}: {
  id: string
  title: ReactNode
  description?: ReactNode
}) {
  return (
    <div className='flex flex-col gap-1 px-5 pb-3 pt-[18px]'>
      <h2 id={id} className='m-0 text-base font-bold'>
        {title}
      </h2>
      {description && (
        <p className='m-0 text-[13px] text-[var(--jr-muted)]'>{description}</p>
      )}
    </div>
  )
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-5 pb-5 pt-3 max-sm:flex-wrap [&>button]:max-sm:flex-1',
        className
      )}
    >
      {children}
    </div>
  )
}
