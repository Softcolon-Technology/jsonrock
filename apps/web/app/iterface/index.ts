export type ShareType = 'json' | 'text' | 'markdown' | 'html'

export function getEditorBasePath(type: ShareType): string {
  switch (type) {
    case 'text':
      return '/editor/text'
    case 'markdown':
      return '/editor/markdown'
    case 'html':
      return '/editor/html'
    default:
      return '/editor'
  }
}

/** In-app path for a standalone Workspace file. */
export function getStandaloneWorkspaceFileBasePath(type: ShareType): string {
  switch (type) {
    case 'text':
      return '/workspace/files/text'
    case 'markdown':
      return '/workspace/files/markdown'
    case 'html':
      return '/workspace/files/html'
    default:
      return '/workspace/files/json'
  }
}

/** In-app path for a file inside a Workspace project. */
export function getWorkspaceFileBasePath(
  projectId: string,
  type: ShareType
): string {
  const id = encodeURIComponent(projectId)
  switch (type) {
    case 'text':
      return `/workspace/projects/${id}/text`
    case 'markdown':
      return `/workspace/projects/${id}/markdown`
    case 'html':
      return `/workspace/projects/${id}/html`
    default:
      return `/workspace/projects/${id}/json`
  }
}

/** True when the pathname is a Workspace file editor (project or standalone). */
export function isWorkspaceFileEditorPath(pathname: string): boolean {
  return (
    /^\/workspace\/projects\/[^/]+\/(json|text|markdown|html)(\/|$)/.test(
      pathname
    ) || /^\/workspace\/files\/(json|text|markdown|html)(\/|$)/.test(pathname)
  )
}

/** @deprecated Use {@link isWorkspaceFileEditorPath} */
export function isWorkspaceProjectFilePath(pathname: string): boolean {
  return isWorkspaceFileEditorPath(pathname)
}

/** Project id from `/workspace/projects/:id/(json|text|markdown|html)/…`, else null. */
export function projectIdFromWorkspaceFilePath(
  pathname: string
): string | null {
  const m = pathname.match(
    /^\/workspace\/projects\/([^/]+)\/(json|text|markdown|html)(\/|$)/
  )
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

/**
 * Document URL path + fragment.
 * - `purpose: 'app'` (default): `/workspace/files/…` or `/workspace/projects/…`
 * - `purpose: 'share'`: public `/editor/…` view-only link
 */
export function buildDocumentUrl(input: {
  type: ShareType
  slug: string
  /** JSON view mode (`formatter` | `visualize` | …). Ignored for non-json types. */
  viewMode?: string
  /** Public encryption key. Omit / empty for private links. */
  keyString?: string | null
  isPrivate?: boolean
  /** When set (and purpose is app), path is under `/workspace/projects/:id/…`. */
  projectId?: string | null
  /**
   * `app` = open in Workspace. `share` = public /editor link (view-only for recipients).
   * @default 'app'
   */
  purpose?: 'app' | 'share'
  /** Defaults to `window.location.origin` in the browser. */
  origin?: string
}): string {
  const purpose = input.purpose ?? 'app'
  let base: string
  if (purpose === 'share') {
    base = getEditorBasePath(input.type)
  } else if (input.projectId) {
    base = getWorkspaceFileBasePath(input.projectId, input.type)
  } else {
    base = getStandaloneWorkspaceFileBasePath(input.type)
  }
  const viewParam =
    input.type === 'json' && input.viewMode ? `?view=${input.viewMode}` : ''
  const fragment =
    !input.isPrivate && input.keyString ? `#key=${input.keyString}` : ''
  const path = `${base}/${input.slug}${viewParam}${fragment}`
  if (input.origin) return `${input.origin.replace(/\/$/, '')}${path}`
  return path
}
