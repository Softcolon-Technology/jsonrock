'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { invalidateRemoteLibrary } from '@/lib/api/library-cache'
import {
  DEFAULT_DOCUMENT_TITLE,
  getLocalDocumentBySlug,
  isPlaceholderDocumentTitle,
  syncTitle,
  type LocalDocumentType,
} from '@/lib/local-docs'

export interface UseDocumentTitleOptions {
  /** Re-read the local title whenever a save finishes (auto-derived titles change). */
  isSaving?: boolean
  /** Remote rename (PATCH /api/share/:slug) when the doc is a remote file the user may edit. */
  remoteRename?: ((title: string) => Promise<void>) | null
  /** Remote file title, shown when there is no local (IndexedDB) copy yet. */
  remoteTitle?: string | null
  /**
   * True once GET /api/files/:slug has settled and a remote file exists.
   * Used to backfill remote "Untitled" from a meaningful local name.
   */
  remoteAvailable?: boolean
}

const PENDING_TITLE_KEY = 'jr-pending-doc-title'

function readPendingTitle(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(PENDING_TITLE_KEY)
    return v?.trim() || null
  } catch {
    return null
  }
}

function writePendingTitle(title: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (!title) sessionStorage.removeItem(PENDING_TITLE_KEY)
    else sessionStorage.setItem(PENDING_TITLE_KEY, title)
  } catch {
    // ignore
  }
}

/** Consume and clear a title typed before the document had a slug. */
export function takePendingDocumentTitle(): string | null {
  const t = readPendingTitle()
  writePendingTitle(null)
  return t
}

function pickDisplayTitle(
  type: LocalDocumentType,
  local: string,
  localIsCustom: boolean,
  remote: string
): string {
  const fallback = DEFAULT_DOCUMENT_TITLE[type]
  // Explicit local rename always wins.
  if (localIsCustom && local) return local
  // Real remote name beats auto/local placeholders.
  if (remote && !isPlaceholderDocumentTitle(remote, type)) return remote
  // Keep named local files (incl. pre-Workspace content-derived titles).
  if (local && !isPlaceholderDocumentTitle(local, type)) return local
  return remote || local || fallback
}

/**
 * Title of the open document. Titles live in IndexedDB (never sent in the E2EE
 * payload); a remote rename, when available, is applied first and then mirrored locally.
 */
export function useDocumentTitle(
  slug: string | null,
  type: LocalDocumentType,
  {
    isSaving = false,
    remoteRename = null,
    remoteTitle = null,
    remoteAvailable = false,
  }: UseDocumentTitleOptions = {}
) {
  const fallback = DEFAULT_DOCUMENT_TITLE[type]
  const [title, setTitle] = useState<string>(fallback)
  const backfilledSlug = useRef<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setTitle(readPendingTitle() || fallback)
      return
    }
    if (isSaving) return
    let cancelled = false
    getLocalDocumentBySlug(slug)
      .then((record) => {
        if (cancelled) return
        const local = record?.title?.trim() || ''
        const remote = remoteTitle?.trim() || ''
        const localIsCustom = record?.titleIsCustom === true
        setTitle(pickDisplayTitle(type, local, localIsCustom, remote))
      })
      .catch(() => {
        if (!cancelled) {
          const remote = remoteTitle?.trim() || ''
          setTitle(pickDisplayTitle(type, '', false, remote))
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug, type, fallback, isSaving, remoteTitle])

  // Once remote meta is loaded: if API still says Untitled but IndexedDB has a
  // real name, push that name to the server so Workspace/library match local.
  useEffect(() => {
    if (!slug || !remoteRename || !remoteAvailable) return
    if (backfilledSlug.current === slug) return

    let cancelled = false
    ;(async () => {
      try {
        const record = await getLocalDocumentBySlug(slug)
        if (cancelled || !record) return
        const local = record.title?.trim() || ''
        const remote = remoteTitle?.trim() || ''
        if (
          !local ||
          isPlaceholderDocumentTitle(local, type) ||
          !isPlaceholderDocumentTitle(remote, type)
        ) {
          backfilledSlug.current = slug
          return
        }
        await remoteRename(local)
        if (cancelled) return
        await syncTitle(slug, local)
        if (cancelled) return
        invalidateRemoteLibrary()
        setTitle(local)
        backfilledSlug.current = slug
      } catch {
        // Keep local display; retry next open.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, type, remoteRename, remoteTitle, remoteAvailable])

  useEffect(() => {
    backfilledSlug.current = null
  }, [slug])

  /** Throws when the remote rename fails (local copy is left untouched). */
  const rename = useCallback(
    async (next: string) => {
      const trimmed = next.trim()
      if (!trimmed) return
      if (!slug) {
        // Draft name until the first save creates a slug.
        writePendingTitle(trimmed)
        setTitle(trimmed)
        return
      }
      if (remoteRename) await remoteRename(trimmed)
      const record = await syncTitle(slug, trimmed)
      setTitle(record?.title ?? trimmed)
      writePendingTitle(null)
    },
    [slug, remoteRename]
  )

  // Browser tab title — matches layout template `%s | JsonRock`.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const previous = document.title
    document.title = `${title} | JsonRock`
    return () => {
      document.title = previous
    }
  }, [title])

  // Editable even before first save (draft title); remote persist waits for a slug.
  return { title, rename, canRename: true }
}
