'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiError } from '@/lib/api/client'
import { deleteFile, moveFile, renameFile } from '@/lib/api/files'
import { invalidateRemoteLibrary } from '@/lib/api/library-cache'
import {
  deleteProject,
  getProject,
  inviteToProject,
  removeMember,
  renameProject,
  revokeInvite,
  updateMemberRole,
} from '@/lib/api/projects'
import { deleteLocalDocumentBySlug } from '@/lib/local-docs'
import { getSocket } from '@/lib/socket'
import { errorMessage } from '@/hooks/use-library'
import { normalizeInvite } from '@/types/library'
import type {
  FileLabel,
  InviteRole,
  ProjectDetail,
  ProjectInvite,
  RemoteFile,
} from '@/types/library'

export type ProjectLoadError =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'failed'

type FilesChangedPayload = {
  projectId?: string
  reason?: 'added' | 'updated' | 'removed' | 'moved'
  slug?: string
  file?: RemoteFile
}

export function useProject(id: string) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const detailRef = useRef<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<ProjectLoadError | null>(null)

  const applyDetail = useCallback((next: ProjectDetail) => {
    const normalized: ProjectDetail = {
      project: next.project,
      files: next.files ?? [],
      members: next.members ?? [],
      pendingInvites: next.pendingInvites ?? [],
      invites: next.pendingInvites ?? next.invites ?? [],
      myRole: next.myRole,
    }
    detailRef.current = normalized
    setDetail(normalized)
  }, [])

  const refresh = useCallback(
    async (opts?: { soft?: boolean }) => {
      const soft = opts?.soft && detailRef.current !== null
      if (soft) setRefreshing(true)
      try {
        const next = await getProject(getToken, id)
        applyDetail(next)
        setError(null)
        setErrorKind(null)
      } catch (e) {
        setError(errorMessage(e, 'Could not load this project'))
        setErrorKind(
          isApiError(e) && e.kind !== 'http' ? e.kind : ('failed' as const)
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, id, applyDetail]
  )

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, id])

  // Live file-list patches (full soft refresh only as fallback).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const socket = getSocket()
    const onFilesChanged = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const p = payload as FilesChangedPayload
      if (p.projectId !== id) return

      if (p.reason === 'added' && p.file) {
        const file = p.file
        setDetail((d) => {
          if (!d) return d
          const files = [file, ...d.files.filter((f) => f.slug !== file.slug)]
          return {
            ...d,
            files,
            project: { ...d.project, fileCount: files.length },
          }
        })
        invalidateRemoteLibrary()
        return
      }

      if (p.reason === 'updated' && p.file) {
        const file = p.file
        setDetail((d) =>
          d
            ? {
                ...d,
                files: d.files.map((f) =>
                  f.slug === file.slug ? { ...f, ...file } : f
                ),
              }
            : d
        )
        invalidateRemoteLibrary()
        return
      }

      if (
        (p.reason === 'removed' || p.reason === 'moved') &&
        typeof p.slug === 'string'
      ) {
        const slug = p.slug
        setDetail((d) => {
          if (!d) return d
          const files = d.files.filter((f) => f.slug !== slug)
          return {
            ...d,
            files,
            project: { ...d.project, fileCount: files.length },
          }
        })
        invalidateRemoteLibrary()
        return
      }

      void refresh({ soft: true })
    }

    // Invite accepted / declined / revoked — drop pending row; soft-refresh
    // on accept so the new member appears without a full page reload.
    const onInviteResolved = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const p = payload as {
        projectId?: string
        token?: string
        status?: string
      }
      if (p.projectId !== id || typeof p.token !== 'string') return

      const token = p.token
      setDetail((d) => {
        if (!d) return d
        const invites = d.invites.filter((i) => (i.token ?? i.id) !== token)
        if (invites.length === d.invites.length) return d
        return {
          ...d,
          invites,
          pendingInvites: invites,
          project: {
            ...d.project,
            pendingInviteCount: invites.length,
          },
        }
      })

      if (p.status === 'accepted') {
        invalidateRemoteLibrary()
        void refresh({ soft: true })
      }
    }

    socket.on('project-files-changed', onFilesChanged)
    socket.on('project-invite-resolved', onInviteResolved)
    return () => {
      socket.off('project-files-changed', onFilesChanged)
      socket.off('project-invite-resolved', onInviteResolved)
    }
  }, [isLoaded, isSignedIn, id, refresh])

  const prependFile = useCallback((file: RemoteFile) => {
    invalidateRemoteLibrary()
    setDetail((d) => {
      if (!d) return d
      if (d.files.some((f) => f.slug === file.slug)) return d
      return {
        ...d,
        files: [file, ...d.files],
        project: {
          ...d.project,
          fileCount: (d.project.fileCount ?? d.files.length) + 1,
        },
      }
    })
  }, [])

  const rename = useCallback(
    async (name: string) => {
      await renameProject(getToken, id, name)
      setDetail((d) => (d ? { ...d, project: { ...d.project, name } } : d))
    },
    [getToken, id]
  )

  const invite = useCallback(
    async (email: string, role: InviteRole) => {
      const res = await inviteToProject(getToken, id, email, role)
      const inviteDto = normalizeInvite(res.invite)
      if (inviteDto) {
        setDetail((d) => {
          if (!d) return d
          const invites = [
            inviteDto,
            ...d.invites.filter((i) => (i.token ?? i.id) !== inviteDto.token),
          ]
          return {
            ...d,
            invites,
            pendingInvites: invites,
            project: {
              ...d.project,
              pendingInviteCount: invites.length,
            },
          }
        })
        return
      }
      await refresh({ soft: true })
    },
    [getToken, id, refresh]
  )

  const revoke = useCallback(
    async (inviteId: string) => {
      await revokeInvite(getToken, id, inviteId)
      setDetail((d) => {
        if (!d) return d
        const invites = d.invites.filter((i) => (i.token ?? i.id) !== inviteId)
        return {
          ...d,
          invites,
          pendingInvites: invites,
          project: {
            ...d.project,
            pendingInviteCount: invites.length,
          },
        }
      })
    },
    [getToken, id]
  )

  const setRole = useCallback(
    async (userId: string, role: InviteRole) => {
      await updateMemberRole(getToken, id, userId, role)
      setDetail((d) =>
        d
          ? {
              ...d,
              members: d.members.map((m) =>
                m.userId === userId ? { ...m, role } : m
              ),
            }
          : d
      )
    },
    [getToken, id]
  )

  const remove = useCallback(
    async (userId: string) => {
      await removeMember(getToken, id, userId)
      setDetail((d) => {
        if (!d) return d
        const members = d.members.filter((m) => m.userId !== userId)
        return {
          ...d,
          members,
          project: { ...d.project, memberCount: members.length },
        }
      })
    },
    [getToken, id]
  )

  const destroy = useCallback(async () => {
    const slugs = detail?.files.map((f) => f.slug) ?? []
    await deleteProject(getToken, id)
    invalidateRemoteLibrary()
    await Promise.all(
      slugs.map((s) => deleteLocalDocumentBySlug(s).catch(() => undefined))
    )
  }, [getToken, id, detail])

  const renameFileTitle = useCallback(
    async (slug: string, title: string) => {
      await renameFile(getToken, slug, title)
      invalidateRemoteLibrary()
      setDetail((d) =>
        d
          ? {
              ...d,
              files: d.files.map((f) =>
                f.slug === slug ? { ...f, title } : f
              ),
            }
          : d
      )
    },
    [getToken]
  )

  /** Move a file in (`id`) or out (`null`) of this project. */
  const moveFileTo = useCallback(
    async (slug: string, projectId: string | null) => {
      await moveFile(getToken, slug, projectId)
      invalidateRemoteLibrary()
      if (projectId === null || projectId !== id) {
        setDetail((d) => {
          if (!d) return d
          const files = d.files.filter((f) => f.slug !== slug)
          return {
            ...d,
            files,
            project: { ...d.project, fileCount: files.length },
          }
        })
        return
      }
      await refresh({ soft: true })
    },
    [getToken, id, refresh]
  )

  const removeFile = useCallback(
    async (slug: string) => {
      await deleteFile(getToken, slug)
      await deleteLocalDocumentBySlug(slug).catch(() => undefined)
      invalidateRemoteLibrary()
      setDetail((d) => {
        if (!d) return d
        const files = d.files.filter((f) => f.slug !== slug)
        return {
          ...d,
          files,
          project: { ...d.project, fileCount: files.length },
        }
      })
    },
    [getToken]
  )

  const patchFileLabels = useCallback((slug: string, labels: FileLabel[]) => {
    setDetail((d) =>
      d
        ? {
            ...d,
            files: d.files.map((f) => (f.slug === slug ? { ...f, labels } : f)),
          }
        : d
    )
  }, [])

  return {
    detail,
    loading,
    refreshing,
    error,
    errorKind,
    refresh: () => refresh({ soft: !!detailRef.current }),
    prependFile,
    rename,
    invite,
    revoke,
    setRole,
    remove,
    destroy,
    renameFile: renameFileTitle,
    moveFile: moveFileTo,
    removeFile,
    patchFileLabels,
  }
}
