import {
  normalizeProject,
  type FilesLibraryResponse,
  type Project,
  type RemoteFile,
} from '@/types/library'
import { apiFetch, type TokenGetter } from './client'

function normalizeFilesResponse(
  raw: FilesLibraryResponse
): FilesLibraryResponse {
  return {
    standalone: raw.standalone ?? [],
    projects: (raw.projects ?? []).map((entry) => ({
      project: normalizeProject(entry.project),
      files: entry.files ?? [],
    })),
  }
}

/**
 * GET /api/files → { standalone, projects: [{ project, files }] }
 */
export async function listLibrary(
  getToken: TokenGetter
): Promise<FilesLibraryResponse> {
  const raw = await apiFetch<FilesLibraryResponse>('/files', { getToken })
  return normalizeFilesResponse(raw)
}

/** GET /api/files/:slug — single file (+ project) for the editor chrome. */
export async function getFileMeta(
  getToken: TokenGetter,
  slug: string
): Promise<{ file: RemoteFile; project: Project | null }> {
  const raw = await apiFetch<{
    file: RemoteFile
    project?: Project | null
  }>(`/files/${encodeURIComponent(slug)}`, { getToken })
  return {
    file: raw.file,
    project: raw.project ? normalizeProject(raw.project) : null,
  }
}

/** PATCH /api/share/:slug — rename and/or move in/out of a project. */
export function updateFile(
  getToken: TokenGetter,
  slug: string,
  patch: { title?: string; projectId?: string | null }
): Promise<{ file?: RemoteFile }> {
  return apiFetch(`/share/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: patch,
    getToken,
  })
}

export function renameFile(getToken: TokenGetter, slug: string, title: string) {
  return updateFile(getToken, slug, { title })
}

export function moveFile(
  getToken: TokenGetter,
  slug: string,
  projectId: string | null
) {
  return updateFile(getToken, slug, { projectId })
}

/** DELETE /api/share/:slug — removes the remote copy. */
export function deleteFile(getToken: TokenGetter, slug: string) {
  return apiFetch<{ ok?: boolean }>(`/share/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    getToken,
  })
}
