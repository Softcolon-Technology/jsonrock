/**
 * Client helpers for owner key-wrap (password-doc bypass for Clerk owners).
 */

import {
  deriveWrappingKeyFromUserSecret,
  unwrapContentKey,
  wrapContentKey,
} from './crypto'

async function authHeaders(
  getToken: () => Promise<string | null>
): Promise<Record<string, string> | null> {
  try {
    const token = await getToken()
    if (!token) return null
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  } catch {
    return null
  }
}

/**
 * Fetch the caller's key-wrap secret and wrap the content key for storage.
 * Returns null if the user is not authenticated.
 */
export async function buildOwnerKeyWrapped(
  contentKey: CryptoKey,
  getToken: () => Promise<string | null>
): Promise<string | null> {
  const headers = await authHeaders(getToken)
  if (!headers) return null

  const res = await fetch('/api/share/key-wrap-secret', { headers })
  if (!res.ok) return null

  const data = (await res.json()) as { keyWrapSecret?: string }
  if (!data.keyWrapSecret) return null

  const wrappingKey = await deriveWrappingKeyFromUserSecret(data.keyWrapSecret)
  return wrapContentKey(contentKey, wrappingKey)
}

/**
 * Authenticated owner unlock: fetch wrap materials, unwrap content key.
 * Returns null if the caller is not the owner or wrap is unavailable.
 */
export async function tryOwnerUnwrapContentKey(
  slug: string,
  getToken: () => Promise<string | null>
): Promise<CryptoKey | null> {
  const headers = await authHeaders(getToken)
  if (!headers) return null

  const res = await fetch(`/api/share/${encodeURIComponent(slug)}/owner-unlock`, {
    headers,
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    ownerKeyWrapped?: string
    keyWrapSecret?: string
  }
  if (!data.ownerKeyWrapped || !data.keyWrapSecret) return null

  const wrappingKey = await deriveWrappingKeyFromUserSecret(data.keyWrapSecret)
  return unwrapContentKey(data.ownerKeyWrapped, wrappingKey)
}
