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
  title: string
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

const DEFAULT_TITLE: Record<LocalDocumentType, string> = {
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

function deriveTitle(content: string, type: LocalDocumentType): string {
  // ── JSON: parse and extract a meaningful title ──
  if (type === 'json') {
    try {
      const parsed = JSON.parse(content.trim())

      // Arrays → "Array (N items)"
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return 'Empty Array'
        // Try to describe the first element
        const first = parsed[0]
        if (first && typeof first === 'object' && first !== null) {
          const keys = Object.keys(first)
          return `Array (${parsed.length} items) — {${keys.slice(0, 3).join(', ')}}`
        }
        return `Array (${parsed.length} items)`
      }

      // Objects → look for common "title-like" keys
      if (parsed && typeof parsed === 'object') {
        const titleKeys = [
          'title',
          'name',
          'label',
          'heading',
          'subject',
          'id',
          'key',
          'slug',
          'description',
          'summary',
        ]

        for (const key of titleKeys) {
          // Case-insensitive lookup
          const match = Object.keys(parsed).find((k) => k.toLowerCase() === key)
          if (match && parsed[match] != null) {
            const val = parsed[match]
            const str =
              typeof val === 'string'
                ? val
                : typeof val === 'number' || typeof val === 'boolean'
                  ? String(val)
                  : null
            if (str) return str.slice(0, 60)
          }
        }

        // Fallback: show the first key-value pair
        const keys = Object.keys(parsed)
        if (keys.length > 0) {
          const firstKey = keys[0]!
          const firstVal = parsed[firstKey]
          if (
            typeof firstVal === 'string' ||
            typeof firstVal === 'number' ||
            typeof firstVal === 'boolean'
          ) {
            return `${firstKey}: ${String(firstVal)}`.slice(0, 60)
          }
          // If the value is complex, just show key count
          return `{${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''}}`
        }

        return 'Empty Object'
      }
    } catch {
      // Not valid JSON — fall through to first-line logic
    }
  }

  // ── Markdown: strip heading markers ──
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstLine) {
    return DEFAULT_TITLE[type]
  }

  if (type === 'markdown') {
    return firstLine.replace(/^#+\s*/, '').slice(0, 60) || DEFAULT_TITLE[type]
  }

  if (type === 'html') {
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i)
    if (titleMatch?.[1]?.trim()) return titleMatch[1].trim().slice(0, 60)
    return firstLine.replace(/<[^>]+>/g, '').slice(0, 60) || DEFAULT_TITLE[type]
  }

  // ── Text / fallback ──
  return firstLine.slice(0, 60)
}

export async function saveLocalDocument(
  input: SaveLocalDocumentInput
): Promise<LocalDocumentRecord | null> {
  if (!isIndexedDbAvailable() || !input.slug) {
    return null
  }

  const record: LocalDocumentRecord = {
    slug: input.slug,
    type: input.type,
    mode: input.mode,
    content: input.content,
    isPrivate: input.isPrivate,
    accessType: input.accessType,
    updatedAt: Date.now(),
    title: deriveTitle(input.content, input.type),
    preview: normalizePreview(input.content),
  }

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

export async function getLocalDocumentBySlug(
  slug: string
): Promise<LocalDocumentRecord | null> {
  if (!isIndexedDbAvailable() || !slug) {
    return null
  }

  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(slug)

    request.onsuccess = () => {
      resolve((request.result as LocalDocumentRecord | undefined) || null)
    }

    request.onerror = () =>
      reject(request.error || new Error('Failed to get local document'))

    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
  })
}

export async function listLocalDocuments(): Promise<LocalDocumentRecord[]> {
  if (!isIndexedDbAvailable()) {
    return []
  }

  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const records =
        (request.result as LocalDocumentRecord[] | undefined)?.slice() || []
      records.sort((a, b) => b.updatedAt - a.updatedAt)
      resolve(records)
    }

    request.onerror = () =>
      reject(request.error || new Error('Failed to list local documents'))

    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
  })
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
