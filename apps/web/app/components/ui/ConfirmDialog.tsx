'use client'

import React, { useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'warning' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (
        event.key === 'Enter' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        // Don't steal Enter from the confirm button's own activation
        if (document.activeElement === confirmRef.current) return
        if (document.activeElement === cancelRef.current) return
        event.preventDefault()
        onConfirm()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = [cancelRef.current, confirmRef.current].filter(
        Boolean
      ) as HTMLButtonElement[]
      if (focusable.length < 2) return

      const first = focusable[0]!
      const last = focusable[1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [isOpen, onCancel, onConfirm])

  if (!isOpen) return null

  return (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'
      role='presentation'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role='alertdialog'
        aria-modal='true'
        aria-labelledby='confirm-dialog-title'
        aria-describedby='confirm-dialog-desc'
        className='bg-white border border-zinc-200 text-zinc-900 rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100'
      >
        <button
          type='button'
          onClick={onCancel}
          className='absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors dark:text-zinc-500 dark:hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded'
          aria-label='Close dialog'
          title='Close (Esc)'
        >
          <X size={18} />
        </button>

        <div className='flex flex-col gap-4'>
          <div className='flex items-start gap-3'>
            <div
              className={cn(
                'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                tone === 'danger'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              )}
            >
              <AlertTriangle size={20} />
            </div>
            <div className='min-w-0 pt-0.5'>
              <h3
                id='confirm-dialog-title'
                className='text-lg font-semibold leading-tight'
              >
                {title}
              </h3>
              <p
                id='confirm-dialog-desc'
                className='mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed'
              >
                {description}
              </p>
              <ul className='mt-3 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400'>
                <li>• Scripts and event handlers will run in the preview</li>
                <li>• Console logs and runtime errors will be captured</li>
                <li>• Still sandboxed in an iframe — not full page access</li>
              </ul>
            </div>
          </div>

          <div className='flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-2'>
            <button
              ref={cancelRef}
              type='button'
              onClick={onCancel}
              title='Cancel (Esc)'
              className='px-4 py-2 rounded-lg text-sm font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
            >
              {cancelLabel}
              <span className='ml-1.5 text-[10px] opacity-60'>Esc</span>
            </button>
            <button
              ref={confirmRef}
              type='button'
              onClick={onConfirm}
              title={`${confirmLabel} (Enter)`}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500',
                tone === 'danger'
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              )}
            >
              {confirmLabel}
              <span className='ml-1.5 text-[10px] opacity-80'>Enter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
