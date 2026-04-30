export type LocalDocumentType = 'json' | 'text' | 'markdown'

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
