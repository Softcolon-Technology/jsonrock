'use client'

import { useMemo, useState } from 'react'
import {
  FILE_FILTER_DEFAULTS,
  FILE_LIST_PAGE_SIZE,
  fileFiltersActive,
  filterAndSortFiles,
  type DateFilter,
  type FileListFilterState,
  type SortMode,
  type TypeFilter,
} from '@/lib/file-list-filters'
import type { RemoteFile } from '@/types/library'

export function useFileListFilters(files: RemoteFile[]) {
  const [query, setQuery] = useState(FILE_FILTER_DEFAULTS.query)
  const [type, setType] = useState<TypeFilter>(FILE_FILTER_DEFAULTS.type)
  const [sort, setSort] = useState<SortMode>(FILE_FILTER_DEFAULTS.sort)
  const [date, setDate] = useState<DateFilter>(FILE_FILTER_DEFAULTS.date)
  const [labelIds, setLabelIds] = useState<string[]>(
    FILE_FILTER_DEFAULTS.labelIds
  )
  const [showAll, setShowAll] = useState(false)

  const state: FileListFilterState = { query, type, sort, date, labelIds }

  const sorted = useMemo(
    () => filterAndSortFiles(files, state),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state fields listed
    [files, query, type, sort, date, labelIds]
  )

  const visible = showAll ? sorted : sorted.slice(0, FILE_LIST_PAGE_SIZE)
  const hidden = Math.max(0, sorted.length - FILE_LIST_PAGE_SIZE)
  const canCollapse = showAll && sorted.length > FILE_LIST_PAGE_SIZE
  const filtersActive = fileFiltersActive(state)

  const resetFilters = () => {
    setQuery(FILE_FILTER_DEFAULTS.query)
    setType(FILE_FILTER_DEFAULTS.type)
    setSort(FILE_FILTER_DEFAULTS.sort)
    setDate(FILE_FILTER_DEFAULTS.date)
    setLabelIds(FILE_FILTER_DEFAULTS.labelIds)
    setShowAll(false)
  }

  const setTypeFilter = (next: TypeFilter) => {
    setType(next)
    setShowAll(false)
  }

  const setDateFilter = (next: DateFilter) => {
    setDate(next)
    setShowAll(false)
  }

  const setQueryFilter = (next: string) => {
    setQuery(next)
    setShowAll(false)
  }

  const toggleLabelFilter = (id: string) => {
    setLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setShowAll(false)
  }

  return {
    query,
    type,
    sort,
    date,
    labelIds,
    setQuery: setQueryFilter,
    setType: setTypeFilter,
    setSort,
    setDate: setDateFilter,
    toggleLabelFilter,
    setLabelIds,
    resetFilters,
    filtersActive,
    sorted,
    visible,
    hidden,
    showAll,
    setShowAll,
    canCollapse,
  }
}
