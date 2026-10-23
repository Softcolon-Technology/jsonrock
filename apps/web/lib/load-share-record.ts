import type { ShareType } from '@/app/iterface'

/** Shape passed into EditorPage as `initialRecord`. */
export type ShareInitialRecord = {
  slug: string
  type: ShareType
  schemaVersion: number
  isLegacyPlaintext: boolean
  json: string
  ciphertext: string
  iv: string
  salt?: string
  mode: string
  isPrivate: boolean
  accessType: string
  previewOnly: boolean
  ownerId: string | null
  hasOwnerKeyWrapped: boolean
  createdAt: string
  updatedAt: string
}

/** Server-side fetch for editor slug pages. */
export async function loadShareRecord(
  slug: string,
  fallbackType: ShareType
): Promise<ShareInitialRecord | undefined> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/share/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return undefined
    const data = await res.json()
    const isLegacy = Boolean(data.isLegacyPlaintext)
    const type = (data.type || fallbackType) as ShareType
    return {
      slug: data.slug,
      type,
      schemaVersion: data.schemaVersion || (isLegacy ? 1 : 2),
      isLegacyPlaintext: isLegacy,
      json: isLegacy
        ? typeof data.data === 'string'
          ? data.data
          : JSON.stringify(data.data, null, type === 'json' ? 2 : undefined)
        : data.json || '',
      ciphertext: data.ciphertext || '',
      iv: data.iv || '',
      salt: data.salt || undefined,
      mode: data.mode || 'visualize',
      isPrivate: data.isPrivate || false,
      accessType: data.accessType || 'editor',
      previewOnly: data.previewOnly === true,
      ownerId: data.ownerId || null,
      hasOwnerKeyWrapped: data.hasOwnerKeyWrapped === true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error fetching share link:', error)
    return undefined
  }
}
