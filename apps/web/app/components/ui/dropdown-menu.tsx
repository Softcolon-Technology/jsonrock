'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface DropdownMenuItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  testId?: string
}

export interface TriggerProps {
  onClick: () => void
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string
}

export interface DropdownMenuProps {
  renderTrigger: (props: TriggerProps) => ReactNode
  items: DropdownMenuItem[]
  align?: 'start' | 'end'
  className?: string
  menuClassName?: string
  menuTestId?: string
  wrapperProps?: HTMLAttributes<HTMLDivElement>
}

/**
 * Menu is portaled to document.body with fixed coords so it is never clipped
 * by overflow:hidden ancestors (e.g. the Files modal scroller).
 */
export function DropdownMenu({
  renderTrigger,
  items,
  align = 'end',
  className,
  menuClassName,
  menuTestId,
  wrapperProps,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current
    const menu = menuRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuW = menu?.offsetWidth ?? 220
    const menuH = menu?.offsetHeight ?? 180
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
  }, [open, updatePosition, items.length])

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
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
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

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-block', className)}
      {...wrapperProps}
    >
      {renderTrigger({
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
      })}
      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role='menu'
            data-testid={menuTestId}
            style={
              pos
                ? { position: 'fixed', top: pos.top, left: pos.left }
                : { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }
            }
            className={cn(
              'z-[200] min-w-[180px] rounded-xl border border-[var(--jr-border)] bg-[var(--jr-surface)] p-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]',
              menuClassName
            )}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type='button'
                role='menuitem'
                disabled={item.disabled}
                data-testid={item.testId}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--jr-hover)] focus-visible:bg-[var(--jr-hover)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  item.danger
                    ? 'text-[var(--jr-danger)] hover:bg-[var(--jr-danger-soft)]'
                    : 'text-[var(--jr-text)]'
                )}
              >
                {item.icon && (
                  <span className='flex shrink-0 text-[var(--jr-muted)]'>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
