const DB_NAME = 'jsonrock-diff-db'
const DB_VERSION = 1
const STORE_NAME = 'diffs'

export interface DiffRecord {
  id?: number
  name: string
  original: string
  modified: string
  createdAt: number
  updatedAt: number
}

function openDiffDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveDiff(diff: Omit<DiffRecord, 'id'>): Promise<number> {
  const db = await openDiffDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(diff)
    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error)
  })
}

export async function updateDiff(
  id: number,
  diff: Partial<Omit<DiffRecord, 'id'>>
): Promise<void> {
  const db = await openDiffDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)

    getReq.onsuccess = () => {
      const existing = getReq.result as DiffRecord | undefined
      if (!existing) {
        reject(new Error(`Diff with id ${id} not found`))
        return
      }
      const updated = { ...existing, ...diff, updatedAt: Date.now() }
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function getAllDiffs(): Promise<DiffRecord[]> {
  const db = await openDiffDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      // Return newest first
      const results = (request.result as DiffRecord[]).sort(
        (a, b) => b.updatedAt - a.updatedAt
      )
      resolve(results)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getDiff(id: number): Promise<DiffRecord | undefined> {
  const db = await openDiffDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result as DiffRecord | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function deleteDiff(id: number): Promise<void> {
  const db = await openDiffDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
