'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'
import {
  acceptInvite,
  declineInvite,
  listPendingInvites,
} from '@/lib/api/invites'
import type { ProjectInvite } from '@/types/library'

/** Pending project invites for the signed-in user's email. */
export function useInvites() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [invites, setInvites] = useState<ProjectInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [busyToken, setBusyToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { invites: next } = await listPendingInvites(getToken)
      setInvites(
        (next ?? []).filter((i) => !i.status || i.status === 'pending')
      )
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load invites')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    void refresh()
  }, [isLoaded, isSignedIn, refresh])

  const accept = useCallback(
    async (token: string) => {
      setBusyToken(token)
      try {
        const res = await acceptInvite(getToken, token)
        setInvites((l) => l.filter((i) => i.token !== token))
        return res
      } finally {
        setBusyToken(null)
      }
    },
    [getToken]
  )

  const decline = useCallback(
    async (token: string) => {
      setBusyToken(token)
      try {
        await declineInvite(getToken, token)
        setInvites((l) => l.filter((i) => i.token !== token))
      } finally {
        setBusyToken(null)
      }
    },
    [getToken]
  )

  /** Add (or replace) an invite pushed over the socket. */
  const upsert = useCallback((invite: ProjectInvite) => {
    if (invite.status && invite.status !== 'pending') return
    const key = invite.token ?? invite.id
    setInvites((l) => [invite, ...l.filter((i) => (i.token ?? i.id) !== key)])
  }, [])

  /** Drop an invite by token or id (accepted/declined/revoked elsewhere). */
  const remove = useCallback((tokenOrId: string) => {
    setInvites((l) =>
      l.filter((i) => i.token !== tokenOrId && i.id !== tokenOrId)
    )
  }, [])

  return {
    invites,
    loading,
    error,
    busyToken,
    refresh,
    accept,
    decline,
    upsert,
    remove,
  }
}
