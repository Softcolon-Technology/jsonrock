'use client'

import { useId, type ReactNode } from 'react'
import { Button } from './button'
import { Dialog, DialogFooter } from './dialog'

export interface ConfirmDialogProps {
  open: boolean
  title: ReactNode
  description?: ReactNode
  /** Extra body content (e.g. the remote / local copy summary). */
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` = red confirm button, `default` = dark confirm button. */
  variant?: 'danger' | 'default'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Base test id; adds `${testId}-confirm` and `${testId}-cancel`. */
  testId?: string
  /** Override the confirm / cancel button test ids (default `${testId}-confirm` / `-cancel`). */
  confirmTestId?: string
  cancelTestId?: string
}

/** Generic confirm dialog. (Not the HTML-preview `ConfirmDialog.tsx`.) */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy,
  onConfirm,
  onCancel,
  testId,
  confirmTestId,
  cancelTestId,
}: ConfirmDialogProps) {
  const uid = useId()
  const titleId = `${uid}-title`
  const descId = `${uid}-desc`

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      role='alertdialog'
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      dismissible={!busy}
      testId={testId}
    >
      <div className='flex flex-col gap-3 px-5 pb-1 pt-5'>
        <h2 id={titleId} className='m-0 text-[15px] font-bold'>
          {title}
        </h2>
        {description && (
          <p
            id={descId}
            className='m-0 text-[13px] leading-normal text-[var(--jr-text-2)]'
          >
            {description}
          </p>
        )}
        {children}
      </div>
      <DialogFooter>
        <Button
          size='sm'
          variant='secondary'
          onClick={onCancel}
          disabled={busy}
          data-testid={
            cancelTestId ?? (testId ? `${testId}-cancel` : undefined)
          }
          className='h-[38px] rounded-[10px] px-3.5 text-sm text-[#334155]'
        >
          {cancelLabel}
        </Button>
        <Button
          size='sm'
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
          data-testid={
            confirmTestId ?? (testId ? `${testId}-confirm` : undefined)
          }
          className={
            variant === 'danger'
              ? 'h-[38px] rounded-[10px] px-4 text-sm'
              : 'h-[38px] rounded-[10px] bg-[var(--jr-text)] px-4 text-sm hover:bg-[#1e293b]'
          }
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
