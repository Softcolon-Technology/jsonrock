import Cookies from 'js-cookie'
import { buildDocumentUrl } from '@/app/iterface'
// buildDocumentUrl uses projectId → /workspace/projects/… paths
import { encryptContent, generateDocumentKey } from '@/lib/crypto'
import {
  DEFAULT_DOCUMENT_TITLE,
  saveLocalDocument,
  updateLocalDocumentTitle,
} from '@/lib/local-docs'
import type { TokenGetter } from '@/lib/api/client'
import { apiFetch } from '@/lib/api/client'
import { buildOwnerKeyWrapped } from '@/lib/owner-key-wrap'
import type { DocType, RemoteFile } from '@/types/library'

/** Match editor-page ownership cookie so the new doc opens editable. */
function markSlugOwned(slug: string) {
  const owned = Cookies.get('json-rock-owned')
  let slugs: string[] = []
  if (owned) {
    try {
      const parsed = JSON.parse(owned)
      if (Array.isArray(parsed))
        slugs = parsed.filter((s) => typeof s === 'string')
    } catch {
      slugs = []
    }
  }
  if (!slugs.includes(slug)) {
    slugs.push(slug)
    Cookies.set('json-rock-owned', JSON.stringify(slugs), {
      expires: 30,
      path: '/',
    })
  }
}

function defaultContent(type: DocType): string {
  if (type === 'text') return ''
  if (type === 'markdown') return '# Hello Markdown\n\nStart typing...'
  if (type === 'html') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HTML Preview</title>
</head>
<body>
  <h1>Hello HTML</h1>
  <p>Start editing…</p>
</body>
</html>`
  }
  return `{
  "project": "JSON ROCK",
  "visualize": true,
  "features": [
    "Graph View",
    "Tree View",
    "Formatter"
  ]
}`
}

export interface CreatedRemoteFile {
  file: RemoteFile
  openUrl: string
}

/**
 * Create an encrypted blank share (optionally in a project) and return a URL
 * with `#key=` for opening later.
 */
export async function createRemoteFile(
  getToken: TokenGetter,
  type: DocType,
  projectId?: string | null
): Promise<CreatedRemoteFile> {
  const title = DEFAULT_DOCUMENT_TITLE[type]
  const { key, keyString } = await generateDocumentKey()
  const { ciphertext, iv } = await encryptContent(defaultContent(type), key)
  const contentKeyWrapped = await buildOwnerKeyWrapped(key, getToken)

  const created = await apiFetch<{ slug: string; type?: DocType }>('/share', {
    method: 'POST',
    getToken,
    body: {
      ciphertext,
      iv,
      mode: type === 'json' ? 'visualize' : 'formatter',
      type,
      accessType: 'viewer',
      isPrivate: false,
      ...(contentKeyWrapped ? { contentKeyWrapped } : {}),
    },
  })

  if (!created?.slug) {
    throw new Error('Could not create file')
  }

  markSlugOwned(created.slug)

  const patch: { title: string; projectId?: string } = { title }
  if (projectId) patch.projectId = projectId

  const patched = await apiFetch<{ file?: RemoteFile }>(
    `/share/${encodeURIComponent(created.slug)}`,
    {
      method: 'PATCH',
      getToken,
      body: patch,
    }
  )

  const file: RemoteFile =
    patched.file ??
    ({
      slug: created.slug,
      title,
      type: created.type ?? type,
      updatedAt: new Date().toISOString(),
      projectId: projectId ?? null,
      role: 'owner',
      shareMode: 'link',
      updatedByMe: true,
    } satisfies RemoteFile)

  // Seed IndexedDB with the same Untitled title as the library (no content-derived name).
  try {
    await saveLocalDocument({
      slug: file.slug,
      type: file.type,
      mode: type === 'json' ? 'visualize' : 'formatter',
      content: defaultContent(type),
      isPrivate: false,
      accessType: 'viewer',
    })
    await updateLocalDocumentTitle(file.slug, title)
  } catch {
    // Local cache is best-effort; remote title remains authoritative.
  }

  const openUrl = buildDocumentUrl({
    type: file.type,
    slug: file.slug,
    viewMode: type === 'json' ? 'visualize' : undefined,
    keyString,
    projectId: file.projectId ?? projectId ?? null,
  })

  return { file, openUrl }
}

/** @deprecated Prefer {@link createRemoteFile} */
export function createProjectFile(
  getToken: TokenGetter,
  projectId: string,
  type: DocType
): Promise<CreatedRemoteFile> {
  return createRemoteFile(getToken, type, projectId)
}
