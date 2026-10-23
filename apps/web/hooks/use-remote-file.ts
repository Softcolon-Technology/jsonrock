'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteFile, getFileMeta, moveFile, renameFile } from '@/lib/api/files'
import {
  fetchCachedLibrary,
  invalidateRemoteLibrary,
  peekCachedLibrary,
  type CachedLibrary,
  type RemoteProjectGroup,
} from '@/lib/api/library-cache'
import { errorMessage } from '@/hooks/use-library'
import { isProjectsEnabled } from '@/lib/feature-flags'
import type { Project, RemoteFile } from '@/types/library'

export type { RemoteProjectGroup }
export type RemoteLibrary = CachedLibrary
export { invalidateRemoteLibrary }

const EMPTY: CachedLibrary = { standalone: [], groups: [], projects: [] }
const EMPTY_FILE: { file: RemoteFile | null; project: Project | null } = {
  file: null,
  project: null,
}

/** Remote library for the Files modal (Remote tab). No-op when disabled. */
export function useRemoteLibrary(enabled = true) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()
  const cacheKey = userId ?? ''
  const [data, setData] = useState<CachedLibrary>(
    () => peekCachedLibrary(cacheKey) ?? EMPTY
  )
  const [loading, setLoading] = useState(() => !peekCachedLibrary(cacheKey))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = enabled && isProjectsEnabled && isLoaded && !!isSignedIn

  const hasDataRef = useRef(
    data.standalone.length > 0 || data.groups.length > 0
  )
  hasDataRef.current =
    data.standalone.length > 0 ||
    data.groups.length > 0 ||
    !!peekCachedLibrary(cacheKey)

  const refresh = useCallback(
    async (force = false) => {
      if (!active) return
      setError(null)
      if (hasDataRef.current) setRefreshing(true)
      else setLoading(true)
      try {
        setData(await fetchCachedLibrary(getToken, cacheKey, force))
      } catch (e) {
        setError(errorMessage(e, 'Could not load remote files'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [active, getToken, cacheKey]
  )

  useEffect(() => {
    if (!active) return
    void refresh()
    // Intentionally only when auth becomes active — refresh identity is stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const rename = useCallback(
    async (slug: string, title: string) => {
      await renameFile(getToken, slug, title)
      invalidateRemoteLibrary()
      setData((d) => ({
        ...d,
        standalone: d.standalone.map((f) =>
          f.slug === slug ? { ...f, title } : f
        ),
        groups: d.groups.map((g) => ({
          ...g,
          files: g.files.map((f) => (f.slug === slug ? { ...f, title } : f)),
        })),
      }))
    },
    [getToken]
  )

  const move = useCallback(
    async (slug: string, projectId: string | null) => {
      await moveFile(getToken, slug, projectId)
      invalidateRemoteLibrary()
      await refresh(true)
    },
    [getToken, refresh]
  )

  /** Remote delete only — callers remove the IndexedDB copy afterwards. */
  const remove = useCallback(
    async (slug: string) => {
      await deleteFile(getToken, slug)
      invalidateRemoteLibrary()
      setData((d) => ({
        ...d,
        standalone: d.standalone.filter((f) => f.slug !== slug),
        groups: d.groups.map((g) => ({
          ...g,
          files: g.files.filter((f) => f.slug !== slug),
        })),
        projects: d.projects,
      }))
    },
    [getToken]
  )

  const projects = useMemo(() => data.projects, [data.projects])

  return {
    ...data,
    projects,
    loading,
    refreshing,
    error,
    refresh,
    rename,
    move,
    remove,
  }
}

/**
 * Remote metadata for the document open in the editor.
 * Uses GET /api/files/:slug (not the full library).
 */
export function useRemoteFile(slug: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [state, setState] = useState<{
    file: RemoteFile | null
    project: Project | null
  }>(EMPTY_FILE)
  const [loading, setLoading] = useState(false)
  const reqRef = useRef(0)
  const active = isProjectsEnabled && isLoaded && !!isSignedIn && !!slug

  const refresh = useCallback(
    async () => {
      const req = ++reqRef.current
      if (!active || !slug) {
        setState((prev) => (prev.file || prev.project ? EMPTY_FILE : prev))
        return
      }
      const had = Boolean(state.file)
      if (!had) setLoading(true)
      try {
        const next = await getFileMeta(getToken, slug)
        if (req !== reqRef.current) return
        setState({ file: next.file, project: next.project })
      } catch {
        if (req === reqRef.current) setState(EMPTY_FILE)
      } finally {
        if (req === reqRef.current) setLoading(false)
      }
    },
    // state.file only gates the loading spinner — omit from deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, slug, getToken]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const rename = useCallback(
    async (title: string) => {
      if (!slug) return
      await renameFile(getToken, slug, title)
      invalidateRemoteLibrary()
      setState((s) => (s.file ? { ...s, file: { ...s.file, title } } : s))
    },
    [slug, getToken]
  )

  return { ...state, loading, refresh, rename }
}
