'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_DOCUMENT_TITLE,
  getLocalDocumentBySlug,
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
  }: UseDocumentTitleOptions = {}
) {
  const fallback = DEFAULT_DOCUMENT_TITLE[type]
  const [title, setTitle] = useState<string>(fallback)

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
        // Library/remote title wins over auto local titles (incl. old
        // content-derived names). Explicit renames (titleIsCustom) win locally.
        if (localIsCustom && local) {
          setTitle(local)
          return
        }
        setTitle(remote || local || fallback)
      })
      .catch(() => {
        if (!cancelled) setTitle(remoteTitle?.trim() || fallback)
      })
    return () => {
      cancelled = true
    }
  }, [slug, fallback, isSaving, remoteTitle])

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
