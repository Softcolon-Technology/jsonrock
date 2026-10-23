'use client'

import { Bell } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useInviteContext } from './invite-provider'
import { Avatar } from '../ui/avatar'
import { Button } from '../ui/button'
import { formatRelative } from '@/lib/library-format'
import { cn } from '@/lib/utils'

const iconBtn =
  'relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-[var(--jr-hover)] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'

/**
 * Editor-header bell: opens a panel of pending project invites (accept / decline).
 * No-ops when InviteProvider is absent.
 */
export function InvitesBellMenu() {
  const invites = useInviteContext()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => setMounted(true), [])

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current
    const panel = panelRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const panelW = panel?.offsetWidth ?? 340
    const panelH = panel?.offsetHeight ?? 220
    const gap = 6
    const pad = 8
    let left = rect.right - panelW
    left = Math.min(Math.max(pad, left), window.innerWidth - panelW - pad)
    let top = rect.bottom + gap
    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - panelH - gap)
    }
    setPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition, invites?.invites.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
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

  if (!invites) return null

  const count = invites.pendingCount
  const list = invites.invites

  const run = async (token: string, kind: 'accept' | 'decline') => {
    setError(null)
    try {
      if (kind === 'accept') await invites.accept(token)
      else await invites.decline(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <div ref={rootRef} className='relative inline-block'>
      <button
        type='button'
        data-testid='jr-bell'
        onClick={() => setOpen((o) => !o)}
        className={iconBtn}
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={panelId}
        title={
          count > 0
            ? `${count} pending project ${count === 1 ? 'invite' : 'invites'}`
            : 'Project invites'
        }
        aria-label={
          count > 0 ? `Project invites (${count} pending)` : 'Project invites'
        }
      >
        <Bell size={18} aria-hidden='true' />
        {count > 0 && (
          <span
            data-testid='jr-bell-badge'
            className='absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--jr-accent)] px-1 text-[10px] font-bold leading-none text-white'
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role='dialog'
            aria-label='Project invites'
            data-testid='jr-bell-panel'
            style={
              pos
                ? { position: 'fixed', top: pos.top, left: pos.left }
                : { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }
            }
            className={cn(
              'z-[200] box-border flex w-[min(360px,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-[var(--jr-border)] bg-[var(--jr-surface)] shadow-[0_12px_32px_rgba(15,23,42,0.14)]'
            )}
          >
            <div className='border-b border-[var(--jr-border)] px-3.5 py-2.5'>
              <h2 className='m-0 text-sm font-semibold text-[var(--jr-text)]'>
                Project invites
                {count > 0 ? (
                  <span className='font-medium text-[var(--jr-muted-2)]'>
                    {' '}
                    · {count}
                  </span>
                ) : null}
              </h2>
            </div>

            {error && (
              <div
                role='alert'
                className='border-b border-[#fecaca] bg-[var(--jr-danger-soft)] px-3.5 py-2 text-[13px] text-[var(--jr-danger)]'
              >
                {error}
              </div>
            )}

            {list.length === 0 ? (
              <p className='m-0 px-3.5 py-6 text-center text-[13px] text-[var(--jr-muted)]'>
                No pending invites.
              </p>
            ) : (
              <ul className='m-0 max-h-[min(420px,70vh)] list-none overflow-y-auto p-0'>
                {list.map((invite) => {
                  const token = invite.token ?? invite.id
                  const busy = invites.busyToken === token
                  const inviter =
                    invite.invitedByName ?? invite.invitedByEmail ?? 'Someone'
                  return (
                    <li
                      key={token}
                      data-testid={`jr-bell-invite-${token}`}
                      className='flex flex-col gap-2.5 border-b border-[var(--jr-border)] px-3.5 py-3 last:border-b-0'
                    >
                      <div className='flex items-start gap-2.5'>
                        <Avatar
                          name={inviter}
                          colorKey={invite.invitedByEmail ?? inviter}
                          imageUrl={invite.invitedByImageUrl}
                          size={36}
                        />
                        <div className='min-w-0 flex-1'>
                          <p className='m-0 text-[13px] leading-[1.4] text-[var(--jr-text)]'>
                            <strong className='font-semibold'>{inviter}</strong>{' '}
                            invited you to{' '}
                            <strong className='font-semibold'>
                              {invite.projectName}
                            </strong>{' '}
                            as {invite.role === 'editor' ? 'Editor' : 'Viewer'}
                          </p>
                          <span className='text-[12px] text-[var(--jr-muted)]'>
                            {formatRelative(invite.createdAt) || 'just now'}
                          </span>
                        </div>
                      </div>
                      <div className='flex items-center justify-end gap-2'>
                        <Button
                          size='sm'
                          variant='secondary'
                          className='text-[#334155]'
                          disabled={busy}
                          onClick={() => void run(token, 'decline')}
                          data-testid={`jr-bell-decline-${token}`}
                        >
                          Decline
                        </Button>
                        <Button
                          size='sm'
                          variant='primary'
                          disabled={busy}
                          onClick={() => void run(token, 'accept')}
                          data-testid={`jr-bell-accept-${token}`}
                        >
                          Accept
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
