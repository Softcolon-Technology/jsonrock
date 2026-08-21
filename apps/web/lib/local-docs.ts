export type LocalDocumentType = 'json' | 'text' | 'markdown' | 'html'

export type LocalDocumentMode = 'visualize' | 'tree' | 'formatter'

export type LocalDocumentAccessType = 'editor' | 'viewer'

export interface LocalDocumentRecord {
  slug: string
  type: LocalDocumentType
  mode: LocalDocumentMode
  content: string
  isPrivate: boolean
  accessType: LocalDocumentAccessType
  updatedAt: number
  /** Display title — local IndexedDB only, never sent to the server. */
  title: string
  /**
   * When true, auto-generation must not overwrite `title` on subsequent saves.
   * Missing on older records — treat as false.
   */
  titleIsCustom: boolean
  preview: string
}

interface SaveLocalDocumentInput {
  slug: string
  type: LocalDocumentType
  mode: LocalDocumentMode
  content: string
  isPrivate: boolean
  accessType: LocalDocumentAccessType
}

const DB_NAME = 'jsonrock-local-db'
const DB_VERSION = 1
const STORE_NAME = 'documents'
const TITLE_MAX_LENGTH = 60

export const DEFAULT_DOCUMENT_TITLE: Record<LocalDocumentType, string> = {
  json: 'Untitled JSON',
  text: 'Untitled Text',
  markdown: 'Untitled Markdown',
  html: 'Untitled HTML',
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in this browser'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'slug',
        })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
        store.createIndex('type', 'type', { unique: false })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'))
    }
  })
}

function normalizePreview(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 180)
}

/** Cap stored titles at 60 chars; append "..." when truncated. */
export function truncateDocumentTitle(title: string): string {
  const trimmed = title.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed
  return `${trimmed.slice(0, TITLE_MAX_LENGTH - 3)}...`
}

function stringifyScalar(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

/**
 * Derive a display title from document content (local UI only).
 * Result is already truncated to TITLE_MAX_LENGTH.
 */
export function deriveDocumentTitle(
  content: string,
  type: LocalDocumentType
): string {
  const fallback = DEFAULT_DOCUMENT_TITLE[type]

  if (type === 'json') {
    try {
      const parsed = JSON.parse(content.trim())

      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return 'Empty Array'
        const first = parsed[0]
        if (first && typeof first === 'object' && first !== null) {
          const keys = Object.keys(first)
          return truncateDocumentTitle(
            `Array (${parsed.length} items) — {${keys.slice(0, 3).join(', ')}}`
          )
        }
        return truncateDocumentTitle(`Array (${parsed.length} items)`)
      }

      if (parsed && typeof parsed === 'object') {
        // Prefer project → name → title (case-insensitive)
        const preferredKeys = ['project', 'name', 'title']
        for (const preferred of preferredKeys) {
          const match = Object.keys(parsed).find(
            (k) => k.toLowerCase() === preferred
          )
          if (match != null) {
            const str = stringifyScalar(parsed[match])
            if (str?.trim()) return truncateDocumentTitle(str)
          }
        }

        // Fallback: first scalar key-value pair ("project: JSON ROCK")
        const keys = Object.keys(parsed)
        for (const key of keys) {
          const str = stringifyScalar(parsed[key])
          if (str != null) {
            return truncateDocumentTitle(`${key}: ${str}`)
          }
        }

        if (keys.length > 0) {
          return truncateDocumentTitle(
            `{${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''}}`
          )
        }

        return 'Empty Object'
      }
    } catch {
      // Not valid JSON — fall through
    }

    const firstLine = content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0)
    return firstLine ? truncateDocumentTitle(firstLine) : fallback
  }

  if (type === 'markdown') {
    const heading = content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^#+\s+/.test(line))
    if (heading) {
      const cleaned = heading.replace(/^#+\s+/, '').trim()
      if (cleaned) return truncateDocumentTitle(cleaned)
    }
    return fallback
  }

  if (type === 'html') {
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i)
    if (titleMatch?.[1]?.trim()) {
      return truncateDocumentTitle(titleMatch[1].trim())
    }
    const firstLine = content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0)
    if (firstLine) {
      const text = firstLine.replace(/<[^>]+>/g, '').trim()
      if (text) return truncateDocumentTitle(text)
    }
    return fallback
  }

  // Text: first non-empty line (strip tags — TipTap stores HTML)
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return fallback
  const text = firstLine.replace(/<[^>]+>/g, '').trim()
  return text ? truncateDocumentTitle(text) : fallback
}

function ensureRecordShape(
  raw: Partial<LocalDocumentRecord> & {
    slug: string
    type: LocalDocumentType
    content: string
  }
): LocalDocumentRecord {
  const titleIsCustom = raw.titleIsCustom === true
  const existingTitle =
    typeof raw.title === 'string' ? raw.title.trim() : ''

  let title: string
  if (titleIsCustom && existingTitle) {
    title = truncateDocumentTitle(existingTitle)
  } else if (existingTitle) {
    title = truncateDocumentTitle(existingTitle)
  } else {
    title = deriveDocumentTitle(raw.content || '', raw.type)
  }

  return {
    slug: raw.slug,
    type: raw.type,
    mode: raw.mode || 'formatter',
    content: raw.content || '',
    isPrivate: Boolean(raw.isPrivate),
    accessType: raw.accessType || 'viewer',
    updatedAt: raw.updatedAt || Date.now(),
    title,
    titleIsCustom,
    preview:
      typeof raw.preview === 'string'
        ? raw.preview
        : normalizePreview(raw.content || ''),
  }
}

function needsTitleBackfill(
  raw: Partial<LocalDocumentRecord> | undefined
): boolean {
  if (!raw) return false
  if (typeof raw.title !== 'string' || !raw.title.trim()) return true
  if (raw.titleIsCustom === undefined) return true
  return false
}

async function putRecord(record: LocalDocumentRecord): Promise<LocalDocumentRecord> {
  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(record)

    request.onsuccess = () => resolve(record)
    request.onerror = () =>
      reject(request.error || new Error('Failed to save local document'))

    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
  })
}

async function getRawBySlug(
  slug: string
): Promise<Partial<LocalDocumentRecord> | null> {
  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(slug)

    request.onsuccess = () => {
      resolve(
        (request.result as Partial<LocalDocumentRecord> | undefined) || null
      )
    }
    request.onerror = () =>
      reject(request.error || new Error('Failed to get local document'))

    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
  })
}

/**
 * Persist a local document snapshot.
 * Titles are LOCAL-ONLY (IndexedDB) — never part of the server/E2E payload.
 */
export async function saveLocalDocument(
  input: SaveLocalDocumentInput
): Promise<LocalDocumentRecord | null> {
  if (!isIndexedDbAvailable() || !input.slug) {
    return null
  }

  const existing = await getRawBySlug(input.slug)
  const titleIsCustom = existing?.titleIsCustom === true
  const title =
    titleIsCustom && typeof existing?.title === 'string' && existing.title.trim()
      ? truncateDocumentTitle(existing.title)
      : deriveDocumentTitle(input.content, input.type)

  const record: LocalDocumentRecord = {
    slug: input.slug,
    type: input.type,
    mode: input.mode,
    content: input.content,
    isPrivate: input.isPrivate,
    accessType: input.accessType,
    updatedAt: Date.now(),
    title,
    titleIsCustom,
    preview: normalizePreview(input.content),
  }

  return putRecord(record)
}

/**
 * Rename a local document from the Local History modal.
 * Empty/whitespace input → re-derive auto title and clear titleIsCustom.
 */
export async function updateLocalDocumentTitle(
  slug: string,
  nextTitle: string
): Promise<LocalDocumentRecord | null> {
  if (!isIndexedDbAvailable() || !slug) {
    return null
  }

  const existing = await getRawBySlug(slug)
  if (!existing?.slug || !existing.type) {
    return null
  }

  const trimmed = nextTitle.trim()
  let title: string
  let titleIsCustom: boolean

  if (!trimmed) {
    title = deriveDocumentTitle(existing.content || '', existing.type)
    titleIsCustom = false
  } else {
    title = truncateDocumentTitle(trimmed)
    titleIsCustom = true
  }

  const record = ensureRecordShape({
    slug: existing.slug,
    type: existing.type,
    mode: existing.mode,
    content: existing.content || '',
    isPrivate: existing.isPrivate,
    accessType: existing.accessType,
    preview: existing.preview,
    title,
    titleIsCustom,
    updatedAt: Date.now(),
  })

  return putRecord(record)
}

export async function getLocalDocumentBySlug(
  slug: string
): Promise<LocalDocumentRecord | null> {
  if (!isIndexedDbAvailable() || !slug) {
    return null
  }

  const raw = await getRawBySlug(slug)
  if (!raw || !raw.slug || !raw.type) {
    return null
  }

  const record = ensureRecordShape(
    raw as Partial<LocalDocumentRecord> & {
      slug: string
      type: LocalDocumentType
      content: string
    }
  )

  // Lazy backfill older records missing title / titleIsCustom
  if (needsTitleBackfill(raw)) {
    try {
      await putRecord(record)
    } catch {
      // Display still works even if persist fails
    }
  }

  return record
}

export async function listLocalDocuments(): Promise<LocalDocumentRecord[]> {
  if (!isIndexedDbAvailable()) {
    return []
  }

  const db = await openDb()

  const rawRecords: Partial<LocalDocumentRecord>[] = await new Promise(
    (resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(
          ((request.result as Partial<LocalDocumentRecord>[] | undefined) || []).slice()
        )
      }
      request.onerror = () =>
        reject(request.error || new Error('Failed to list local documents'))

      tx.oncomplete = () => db.close()
      tx.onerror = () => db.close()
      tx.onabort = () => db.close()
    }
  )

  const records: LocalDocumentRecord[] = []
  for (const raw of rawRecords) {
    if (!raw?.slug || !raw.type) continue
    const record = ensureRecordShape(
      raw as Partial<LocalDocumentRecord> & {
        slug: string
        type: LocalDocumentType
        content: string
      }
    )
    records.push(record)

    if (needsTitleBackfill(raw)) {
      try {
        await putRecord(record)
      } catch {
        // Ignore backfill persistence errors
      }
    }
  }

  records.sort((a, b) => b.updatedAt - a.updatedAt)
  return records
}

export async function deleteLocalDocumentBySlug(slug: string): Promise<void> {
  if (!isIndexedDbAvailable() || !slug) {
    return
  }

  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(slug)

    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error || new Error('Failed to delete local document'))

    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
  })
}

export async function clearLocalDocuments(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return
  }

  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error || new Error('Failed to clear local documents'))

    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
  })
}

export const DOCUMENT_TITLE_MAX_LENGTH = TITLE_MAX_LENGTH
