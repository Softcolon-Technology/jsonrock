'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'
import {
  createLabel,
  deleteLabel,
  listLabels,
  setFileLabels,
} from '@/lib/api/labels'
import { invalidateRemoteLibrary } from '@/lib/api/library-cache'
import { DEFAULT_FILE_LABEL_NAMES } from '@/lib/label-catalog'
import type { FileLabel } from '@/types/library'

function missingDefaultNames(labels: FileLabel[]): string[] {
  const have = new Set(
    labels.map((l) => l.name.trim().toLowerCase()).filter(Boolean)
  )
  return DEFAULT_FILE_LABEL_NAMES.filter((n) => !have.has(n))
}

export function useLabels(projectId?: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [labels, setLabels] = useState<FileLabel[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listLabels(getToken, projectId ?? null)
      let next = Array.isArray(res?.labels) ? res.labels : []
      // Server seeds on GET; if defaults are still missing, one retry usually
      // picks them up after a race or a just-migrated catalog.
      if (missingDefaultNames(next).length > 0) {
        const again = await listLabels(getToken, projectId ?? null)
        if (Array.isArray(again?.labels) && again.labels.length > 0) {
          next = again.labels
        }
      }
      setLabels(next)
    } catch (e) {
      console.warn('Failed to load labels', e)
      // Keep prior catalog on refresh failure so assigned pills stay filterable.
    } finally {
      setLoading(false)
    }
  }, [getToken, projectId])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    void refresh()
  }, [isLoaded, isSignedIn, refresh])

  const create = useCallback(
    async (name: string, color?: string) => {
      const res = await createLabel(getToken, {
        name,
        color,
        projectId: projectId ?? null,
      })
      setLabels((prev) => {
        const next = [...prev.filter((l) => l.id !== res.label.id), res.label]
        return next.sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      })
      return res.label
    },
    [getToken, projectId]
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteLabel(getToken, id)
      setLabels((prev) => prev.filter((l) => l.id !== id))
      invalidateRemoteLibrary()
    },
    [getToken]
  )

  const assignToFile = useCallback(
    async (slug: string, labelIds: string[]) => {
      const res = await setFileLabels(getToken, slug, labelIds)
      invalidateRemoteLibrary()
      return res.labels
    },
    [getToken]
  )

  return { labels, loading, refresh, create, remove, assignToFile }
}
