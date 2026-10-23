import type { DocType, RemoteFile } from '@/types/library'

export type TypeFilter = 'all' | DocType
export type SortMode = 'recent' | 'oldest' | 'name'
export type DateFilter = 'any' | 'today' | '7d' | '30d'

export const FILE_SORT_LABEL: Record<SortMode, string> = {
  recent: 'Recent first',
  oldest: 'Oldest first',
  name: 'Name A–Z',
}

export const FILE_DATE_LABEL: Record<DateFilter, string> = {
  any: 'Any date',
  today: 'Edited today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

export const FILE_LIST_PAGE_SIZE = 5

export const FILE_FILTER_DEFAULTS = {
  query: '',
  type: 'all' as TypeFilter,
  sort: 'recent' as SortMode,
  date: 'any' as DateFilter,
  /** Empty = any label; otherwise file must include at least one selected id. */
  labelIds: [] as string[],
}

export interface FileListFilterState {
  query: string
  type: TypeFilter
  sort: SortMode
  date: DateFilter
  labelIds: string[]
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function matchesDateFilter(
  updatedAt: string,
  filter: DateFilter
): boolean {
  if (filter === 'any') return true
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return true
  const now = Date.now()
  if (filter === 'today') return t >= startOfLocalDay()
  if (filter === '7d') return t >= now - 7 * 86_400_000
  if (filter === '30d') return t >= now - 30 * 86_400_000
  return true
}

/** Match title or slug (case-insensitive substring). */
export function matchesFileSearch(file: RemoteFile, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    file.title.toLowerCase().includes(q) || file.slug.toLowerCase().includes(q)
  )
}

export function matchesLabelFilter(
  file: RemoteFile,
  labelIds: string[]
): boolean {
  if (!labelIds.length) return true
  const have = new Set((file.labels ?? []).map((l) => l.id))
  return labelIds.some((id) => have.has(id))
}

export function filterAndSortFiles(
  files: RemoteFile[],
  state: FileListFilterState
): RemoteFile[] {
  const list = files.filter(
    (f) =>
      matchesFileSearch(f, state.query) &&
      (state.type === 'all' || f.type === state.type) &&
      matchesDateFilter(f.updatedAt, state.date) &&
      matchesLabelFilter(f, state.labelIds)
  )
  return [...list].sort((a, b) => {
    if (state.sort === 'name') return a.title.localeCompare(b.title)
    const diff =
      new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    return state.sort === 'recent' ? -diff : diff
  })
}

export function fileFiltersActive(state: FileListFilterState): boolean {
  return (
    state.query.trim() !== FILE_FILTER_DEFAULTS.query ||
    state.type !== FILE_FILTER_DEFAULTS.type ||
    state.sort !== FILE_FILTER_DEFAULTS.sort ||
    state.date !== FILE_FILTER_DEFAULTS.date ||
    state.labelIds.length > 0
  )
}
