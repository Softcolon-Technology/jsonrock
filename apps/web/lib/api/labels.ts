import { apiFetch, type TokenGetter } from './client'
import type { FileLabel } from '@/types/library'

export function listLabels(getToken: TokenGetter, projectId?: string | null) {
  const q =
    projectId != null && projectId !== ''
      ? `?projectId=${encodeURIComponent(projectId)}`
      : ''
  return apiFetch<{ labels: FileLabel[] }>(`/labels${q}`, { getToken })
}

export function createLabel(
  getToken: TokenGetter,
  input: { name: string; color?: string; projectId?: string | null }
) {
  return apiFetch<{ label: FileLabel }>('/labels', {
    method: 'POST',
    getToken,
    body: input,
  })
}

export function deleteLabel(getToken: TokenGetter, id: string) {
  return apiFetch<{ ok?: boolean }>(`/labels/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    getToken,
  })
}

export function setFileLabels(
  getToken: TokenGetter,
  slug: string,
  labelIds: string[]
) {
  return apiFetch<{
    slug: string
    labelIds: string[]
    labels: FileLabel[]
  }>(`/files/${encodeURIComponent(slug)}/labels`, {
    method: 'PUT',
    getToken,
    body: { labelIds },
  })
}
