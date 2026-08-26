import type { ShareType } from '@/app/iterface'

/**
 * In-memory working state for each editor type (JSON / Text / Markdown / HTML).
 *
 * Header "New …" actions navigate between `/editor`, `/editor/text`, etc. Each
 * route remounts `EditorPage`, so React state inside that page is discarded.
 * This module-level store survives those remounts for the lifetime of the JS
 * session (lost on full reload — IndexedDB handles that path).
 */
export type EditorTabViewMode = 'visualize' | 'tree' | 'formatter'

export type EditorTabAccessType = 'editor' | 'viewer'

export interface EditorTabSnapshot {
  type: ShareType
  content: string
  slug: string | null
  viewMode: EditorTabViewMode
  isDocumentPrivate: boolean
  userAccessLevel: EditorTabAccessType
  hasEditPermission: boolean
  isCurrentUserOwner: boolean
  isPrivacyLocked: boolean
  isPasswordLocked: boolean
  isLegacyDocument: boolean
  showMigrationBanner: boolean
  lastPersistedContent: string
  documentPassword: string
  activeKey: CryptoKey | null
  activeKeyString: string | null
  documentSalt: string | null
  encryptedPayload: { ciphertext: string; iv: string } | null
}

const sessions: Partial<Record<ShareType, EditorTabSnapshot>> = {}

export function getEditorTabSession(
  type: ShareType
): EditorTabSnapshot | undefined {
  return sessions[type]
}

export function setEditorTabSession(
  type: ShareType,
  snapshot: EditorTabSnapshot
): void {
  sessions[type] = snapshot
}

export function patchEditorTabSession(
  type: ShareType,
  partial: Partial<EditorTabSnapshot>
): void {
  const existing = sessions[type]
  if (!existing) return
  sessions[type] = { ...existing, ...partial, type }
}

export function clearEditorTabSession(type: ShareType): void {
  delete sessions[type]
}
