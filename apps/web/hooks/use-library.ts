'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiError } from '@/lib/api/client'
import { deleteFile, moveFile, renameFile } from '@/lib/api/files'
import {
  fetchCachedLibrary,
  invalidateRemoteLibrary,
  peekCachedLibrary,
} from '@/lib/api/library-cache'
import { createProject } from '@/lib/api/projects'
import { deleteLocalDocumentBySlug } from '@/lib/local-docs'
import { getSocket } from '@/lib/socket'
import {
  normalizeProject,
  type FileLabel,
  type LibraryData,
  type Project,
  type RemoteFile,
} from '@/types/library'

const EMPTY: LibraryData = { standalone: [], projects: [] }

export function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error) || error instanceof Error) return error.message
  return fallback
}

export function useLibrary() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()
  const cacheKey = userId ?? ''
  const cached = peekCachedLibrary(cacheKey)
  const [data, setData] = useState<LibraryData>(() =>
    cached
      ? { standalone: cached.standalone, projects: cached.projects }
      : EMPTY
  )
  const [loading, setLoading] = useState(() => !cached)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasDataRef = useRef(!!cached)
  hasDataRef.current = data.standalone.length > 0 || data.projects.length > 0

  const refresh = useCallback(
    async (force = false) => {
      setError(null)
      if (hasDataRef.current) setRefreshing(true)
      else setLoading(true)
      try {
        // One shared /files request — projects come embedded (no second /projects call).
        const lib = await fetchCachedLibrary(getToken, cacheKey, force)
        setData({
          standalone: lib.standalone,
          projects: lib.projects,
        })
      } catch (e) {
        setError(errorMessage(e, 'Could not load your library'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, cacheKey]
  )

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, cacheKey])

  // Keep pending-invite badges on project cards in sync when someone accepts.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const socket = getSocket()
    const onInviteResolved = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const p = payload as { projectId?: string; status?: string }
      if (typeof p.projectId !== 'string') return

      setData((d) => ({
        ...d,
        projects: d.projects.map((proj) =>
          proj.id === p.projectId
            ? {
                ...proj,
                pendingInviteCount: Math.max(
                  0,
                  (proj.pendingInviteCount ?? 1) - 1
                ),
              }
            : proj
        ),
      }))

      if (p.status === 'accepted') {
        invalidateRemoteLibrary()
        void refresh(true)
      }
    }
    socket.on('project-invite-resolved', onInviteResolved)
    return () => {
      socket.off('project-invite-resolved', onInviteResolved)
    }
  }, [isLoaded, isSignedIn, refresh])

  const rename = useCallback(
    async (slug: string, title: string) => {
      await renameFile(getToken, slug, title)
      invalidateRemoteLibrary()
      setData((d) => ({
        ...d,
        standalone: d.standalone.map((f) =>
          f.slug === slug ? { ...f, title } : f
        ),
      }))
    },
    [getToken]
  )

  const move = useCallback(
    async (slug: string, projectId: string | null) => {
      await moveFile(getToken, slug, projectId)
      invalidateRemoteLibrary()
      // Optimistic: drop from standalone; soft-refresh for project counts.
      setData((d) => ({
        ...d,
        standalone: d.standalone.filter((f) => f.slug !== slug),
      }))
      setRefreshing(true)
      try {
        const lib = await fetchCachedLibrary(getToken, cacheKey, true)
        setData({
          standalone: lib.standalone,
          projects: lib.projects,
        })
      } finally {
        setRefreshing(false)
      }
    },
    [getToken, cacheKey]
  )

  /** Deletes the remote copy, then the local IndexedDB copy. */
  const remove = useCallback(
    async (slug: string) => {
      await deleteFile(getToken, slug)
      await deleteLocalDocumentBySlug(slug).catch(() => undefined)
      invalidateRemoteLibrary()
      setData((d) => ({
        ...d,
        standalone: d.standalone.filter((f) => f.slug !== slug),
      }))
    },
    [getToken]
  )

  const addProject = useCallback(
    async (name: string): Promise<Project> => {
      const { project } = await createProject(getToken, name)
      const normalized = normalizeProject(project)
      invalidateRemoteLibrary()
      setData((d) => ({ ...d, projects: [normalized, ...d.projects] }))
      return normalized
    },
    [getToken]
  )

  const prependStandalone = useCallback((file: RemoteFile) => {
    invalidateRemoteLibrary()
    setData((d) => {
      if (d.standalone.some((f) => f.slug === file.slug)) return d
      return { ...d, standalone: [file, ...d.standalone] }
    })
  }, [])

  const patchFileLabels = useCallback((slug: string, labels: FileLabel[]) => {
    setData((d) => ({
      ...d,
      standalone: d.standalone.map((f) =>
        f.slug === slug ? { ...f, labels } : f
      ),
    }))
  }, [])

  return {
    ...data,
    loading,
    refreshing,
    error,
    refresh,
    rename,
    move,
    remove,
    createProject: addProject,
    prependStandalone,
    patchFileLabels,
  }
}
