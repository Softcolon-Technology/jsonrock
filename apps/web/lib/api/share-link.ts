import { buildDocumentUrl, type ShareType } from '@/app/iterface'
import { apiFetch, type TokenGetter } from './client'

/**
 * Build a public view-only share URL for a file the caller can read.
 * Uses GET /api/share/:slug/content-key when the document is public.
 */
export async function buildViewOnlyShareUrl(
  getToken: TokenGetter,
  input: {
    slug: string
    type: ShareType
    passwordProtected?: boolean
    viewMode?: string
  }
): Promise<string> {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : undefined

  if (input.passwordProtected) {
    return buildDocumentUrl({
      type: input.type,
      slug: input.slug,
      isPrivate: true,
      purpose: 'share',
      origin,
    })
  }

  const { keyString } = await apiFetch<{ keyString: string }>(
    `/share/${encodeURIComponent(input.slug)}/content-key`,
    { getToken }
  )

  return buildDocumentUrl({
    type: input.type,
    slug: input.slug,
    viewMode: input.viewMode,
    keyString,
    purpose: 'share',
    origin,
  })
}
