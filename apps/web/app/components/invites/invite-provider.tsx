'use client'

import { useAuth } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { InviteToast } from './invite-toast'
import { useInvites } from '@/hooks/use-invites'
import { errorMessage } from '@/hooks/use-library'
import { invalidateRemoteLibrary } from '@/hooks/use-remote-file'
import { getSocket, joinUserRoom } from '@/lib/socket'
import type { ProjectInvite } from '@/types/library'

export interface InviteContextValue {
  /** All pending invites for the signed-in user (dismissed ones included). */
  invites: ProjectInvite[]
  pendingCount: number
  busyToken: string | null
  accept: (token: string) => Promise<void>
  decline: (token: string) => Promise<void>
  /** Drop a token from local state (e.g. after accepting on the email invite page). */
  remove: (token: string) => void
  refresh: () => Promise<void>
}

const InviteContext = createContext<InviteContextValue | null>(null)

/** Pending invites + actions; `null` outside <InviteProvider> (flag off / signed out). */
export function useInviteContext(): InviteContextValue | null {
  return useContext(InviteContext)
}

const DISMISS_KEY = 'jr-dismissed-invite-toasts'

function readDismissed(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

const keyOf = (i: ProjectInvite) => i.token ?? i.id

/** Socket payloads may be the invite itself or `{ invite }`. */
function pickInvite(payload: unknown): ProjectInvite | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as { invite?: unknown } & Partial<ProjectInvite>
  const candidate = (p.invite ?? p) as Partial<ProjectInvite>
  const token = candidate.token ?? candidate.id
  if (!token || !candidate.projectId) return null
  return {
    token,
    id: candidate.id ?? token,
    projectId: candidate.projectId,
    projectName: candidate.projectName ?? 'Project',
    email: candidate.email ?? '',
    role: (candidate.role ?? 'viewer') as ProjectInvite['role'],
    invitedByName: candidate.invitedByName ?? 'Someone',
    invitedByImageUrl: candidate.invitedByImageUrl,
    createdAt: candidate.createdAt ?? new Date().toISOString(),
    expiresAt: candidate.expiresAt ?? '',
    status: 'pending',
    invitedByEmail: candidate.invitedByEmail,
    projectFileCount: candidate.projectFileCount,
    projectMemberCount: candidate.projectMemberCount,
  }
}

function pickResolvedKeys(payload: unknown): string[] {
  if (typeof payload === 'string') return [payload]
  if (!payload || typeof payload !== 'object') return []
  const p = payload as Record<string, unknown>
  const inner = (
    p.invite && typeof p.invite === 'object' ? p.invite : {}
  ) as Record<string, unknown>
  return [p.token, p.inviteId, p.id, inner.token, inner.id].filter(
    (x): x is string => typeof x === 'string'
  )
}

function isInviteAcceptPath(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/workspace/invite')) return true
  if (pathname === '/workspace' || pathname === '/workspace/') {
    try {
      return new URLSearchParams(window.location.search).has('invite')
    } catch {
      return false
    }
  }
  return false
}

export function InviteProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()
  const { invites, busyToken, refresh, accept, decline, upsert, remove } =
    useInvites()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [error, setError] = useState<{ token: string; message: string } | null>(
    null
  )
  // Email / deep-link accept pages already show a full accept UI — don't stack
  // the bottom toast on top of it.
  const [onInviteAcceptPage, setOnInviteAcceptPage] = useState(false)

  useEffect(() => {
    setOnInviteAcceptPage(isInviteAcceptPath(pathname))
  }, [pathname])

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  // Live invites over Socket.IO (`user:{clerkUserId}` room).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return
    const socket = getSocket()
    const onInvite = (payload: unknown) => {
      const invite = pickInvite(payload)
      if (!invite) return
      upsert(invite)
      // A fresh push should surface even if an older one was dismissed.
      setDismissed((d) => d.filter((k) => k !== keyOf(invite)))
    }
    const onResolved = (payload: unknown) => {
      for (const k of pickResolvedKeys(payload)) remove(k)
    }
    socket.on('project-invite', onInvite)
    socket.on('project-invite-resolved', onResolved)
    const leave = joinUserRoom(getToken, userId)
    return () => {
      socket.off('project-invite', onInvite)
      socket.off('project-invite-resolved', onResolved)
      leave()
    }
  }, [isLoaded, isSignedIn, userId, getToken, upsert, remove])

  const dismiss = useCallback((token: string) => {
    setDismissed((d) => {
      const next = d.includes(token) ? d : [...d, token]
      try {
        window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next))
      } catch {
        // storage unavailable — hide for this mount only
      }
      return next
    })
  }, [])

  const acceptInvite = useCallback(
    async (token: string) => {
      setError(null)
      try {
        const res = await accept(token)
        invalidateRemoteLibrary()
        const projectId = res?.projectId
        if (projectId) {
          router.push(`/workspace/projects/${encodeURIComponent(projectId)}`)
        } else {
          router.push('/workspace')
        }
      } catch (e) {
        setError({ token, message: errorMessage(e, 'Could not accept invite') })
      }
    },
    [accept, router]
  )

  const declineInvite = useCallback(
    async (token: string) => {
      setError(null)
      try {
        await decline(token)
      } catch (e) {
        setError({
          token,
          message: errorMessage(e, 'Could not decline invite'),
        })
      }
    },
    [decline]
  )

  const value = useMemo<InviteContextValue>(
    () => ({
      invites,
      pendingCount: invites.length,
      busyToken,
      accept: acceptInvite,
      decline: declineInvite,
      remove,
      refresh,
    }),
    [invites, busyToken, acceptInvite, declineInvite, remove, refresh]
  )

  const visible = onInviteAcceptPage
    ? []
    : invites.filter((i) => !dismissed.includes(keyOf(i)))
  const current = visible[0]

  return (
    <InviteContext.Provider value={value}>
      {children}
      {current && (
        <InviteToast
          key={keyOf(current)}
          invite={current}
          moreCount={visible.length - 1}
          busy={busyToken === keyOf(current)}
          error={error?.token === keyOf(current) ? error.message : null}
          onAccept={() => void acceptInvite(keyOf(current))}
          onDecline={() => void declineInvite(keyOf(current))}
          onDismiss={() => dismiss(keyOf(current))}
        />
      )}
    </InviteContext.Provider>
  )
}
