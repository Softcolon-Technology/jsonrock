import { listLibrary } from '@/lib/api/files'
import type { TokenGetter } from '@/lib/api/client'
import type { FilesLibraryResponse, Project, RemoteFile } from '@/types/library'

export interface RemoteProjectGroup {
  project: Project
  files: RemoteFile[]
}

export interface CachedLibrary {
  standalone: RemoteFile[]
  groups: RemoteProjectGroup[]
  /** Flat project list for the library grid (from the same /files payload). */
  projects: Project[]
}

const CACHE_TTL_MS = 20_000

let cache: {
  key: string
  at: number
  promise: Promise<CachedLibrary>
  data?: CachedLibrary
} | null = null

/** Drop the shared library cache after any remote mutation. */
export function invalidateRemoteLibrary() {
  cache = null
}

function toCached(lib: FilesLibraryResponse): CachedLibrary {
  const groups = (lib.projects ?? []).map((entry) => ({
    project: entry.project,
    files: entry.files ?? [],
  }))
  return {
    standalone: lib.standalone ?? [],
    groups,
    projects: groups.map((g) => g.project),
  }
}

/**
 * Shared in-flight + TTL cache for GET /api/files.
 * Concurrent callers (library page, editor header, files modal) share one request.
 */
export function fetchCachedLibrary(
  getToken: TokenGetter,
  cacheKey: string,
  force = false
): Promise<CachedLibrary> {
  if (
    !force &&
    cache &&
    cache.key === cacheKey &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.promise
  }

  const promise = listLibrary(getToken).then(toCached)
  const entry = { key: cacheKey, at: Date.now(), promise }
  cache = entry
  promise
    .then((data) => {
      if (cache === entry) cache = { ...entry, data }
    })
    .catch(() => {
      if (cache === entry) cache = null
    })
  return promise
}

/** Sync snapshot of the last successful fetch (may be null). */
export function peekCachedLibrary(cacheKey: string): CachedLibrary | null {
  if (!cache || cache.key !== cacheKey || !cache.data) return null
  if (Date.now() - cache.at >= CACHE_TTL_MS) return null
  return cache.data
}
