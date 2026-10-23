import {
  getStandaloneWorkspaceFileBasePath,
  getWorkspaceFileBasePath,
} from '@/app/iterface'
import type { DocType, RemoteFile } from '@/types/library'

export const DOC_TYPE_LABEL: Record<DocType, 'JSON' | 'TEXT' | 'MD' | 'HTML'> =
  {
    json: 'JSON',
    text: 'TEXT',
    markdown: 'MD',
    html: 'HTML',
  }

const EDITOR_NEW_PATH: Record<DocType, string> = {
  json: '/editor',
  text: '/editor/text',
  markdown: '/editor/markdown',
  html: '/editor/html',
}

/** Blank editor URL, optionally scoped to a project (`?projectId=`). */
export function newFileHref(type: DocType, projectId?: string | null): string {
  const base = EDITOR_NEW_PATH[type]
  if (!projectId) return base
  return `${base}?projectId=${encodeURIComponent(projectId)}`
}

/** Route used to open a remote file in the Workspace editor. */
export function fileHref(
  file: Pick<RemoteFile, 'slug' | 'type' | 'projectId'>
): string {
  const slug = encodeURIComponent(file.slug)
  if (file.projectId) {
    return `${getWorkspaceFileBasePath(file.projectId, file.type)}/${slug}`
  }
  return `${getStandaloneWorkspaceFileBasePath(file.type)}/${slug}`
}

/** Public view-only share path (no `#key=`). Prefer {@link buildShareUrl} with a key. */
export function shareHref(file: Pick<RemoteFile, 'slug' | 'type'>): string {
  const slug = encodeURIComponent(file.slug)
  switch (file.type) {
    case 'text':
      return `/editor/text/${slug}`
    case 'markdown':
      return `/editor/markdown/${slug}`
    case 'html':
      return `/editor/html/${slug}`
    default:
      return `/editor/${slug}`
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1000 * 1000)
    return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

/** "35 min ago", "2h ago", "yesterday", "4d ago", "last week", "2 weeks ago". */
export function formatRelative(value: string | number | Date): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'last week'
  if (weeks < 5) return `${weeks} weeks ago`
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(then))
}

export function formatDate(value: string | number | Date): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export function initials(name: string): string {
  const parts = name
    .replace(/@.*$/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const AVATAR_COLORS = ['#0f172a', '#1d4ed8', '#c2410c', '#7c3aed', '#047857']

/** Stable avatar background derived from a string id. */
export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!
}

export function fileMeta(file: RemoteFile, opts: { project?: boolean } = {}) {
  const parts: string[] = []
  const edited = `Edited ${formatRelative(file.updatedAt)}`
  if (opts.project) {
    const by = file.updatedByMe ? 'you' : file.updatedByName
    parts.push(by ? `${edited} by ${by}` : edited)
  } else {
    parts.push(edited)
  }
  const bytes = file.sizeBytes ?? file.size
  if (bytes) parts.push(formatBytes(bytes))
  if (!opts.project) {
    const mode = file.shareMode
    parts.push(
      file.passwordProtected || mode === 'password'
        ? 'Password protected'
        : mode === 'link'
          ? 'Link share on'
          : 'Private'
    )
  }
  return parts.join(' · ')
}
