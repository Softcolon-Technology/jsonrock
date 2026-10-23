'use client'

import { Check, ChevronDown, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { DropdownMenu } from '../ui/dropdown-menu'
import { SearchInput } from '../ui/search-input'
import { LabelMenu } from './label-menu'
import {
  FILE_DATE_LABEL,
  FILE_SORT_LABEL,
  type DateFilter,
  type SortMode,
  type TypeFilter,
} from '@/lib/file-list-filters'
import { DOC_TYPE_LABEL } from '@/lib/library-format'
import type { DocType, FileLabel } from '@/types/library'

const TYPE_ITEMS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All types' },
  ...(['json', 'text', 'markdown', 'html'] as DocType[]).map((t) => ({
    key: t as TypeFilter,
    label: DOC_TYPE_LABEL[t],
  })),
]

export interface FileListToolbarProps {
  /** Section heading count (total files before filter). */
  totalCount: number
  title?: string
  /** Optional hint on the right (e.g. “Not in a project”). */
  hint?: string
  testIdPrefix?: string
  query: string
  type: TypeFilter
  sort: SortMode
  date: DateFilter
  filtersActive: boolean
  onQueryChange: (q: string) => void
  onTypeChange: (t: TypeFilter) => void
  onSortChange: (s: SortMode) => void
  onDateChange: (d: DateFilter) => void
  onReset: () => void
  /** Available labels for filter (personal or project catalog). */
  labels?: FileLabel[]
  labelIds?: string[]
  onToggleLabel?: (id: string) => void
  onClearLabels?: () => void
  /** Owner can create custom labels from the filter menu. */
  canCreateLabel?: boolean
  onCreateLabel?: (name: string, color: string) => Promise<void>
}

/** Shared search + type / date / sort / reset controls for Library & Project files. */
export function FileListToolbar({
  totalCount,
  title = 'Files',
  hint,
  testIdPrefix = 'files',
  query,
  type,
  sort,
  date,
  filtersActive,
  onQueryChange,
  onTypeChange,
  onSortChange,
  onDateChange,
  onReset,
  labels = [],
  labelIds = [],
  onToggleLabel,
  onClearLabels,
  canCreateLabel = false,
  onCreateLabel,
}: FileListToolbarProps) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-2.5'>
      <h2 className='m-0 text-base font-semibold'>
        {title}{' '}
        <span className='font-medium text-[var(--jr-muted-2)]'>
          · {totalCount}
        </span>
      </h2>
      <div className='flex flex-wrap items-center gap-1.5 max-sm:w-full'>
        <SearchInput
          label='Search files by name or slug'
          placeholder='Search name or slug'
          value={query}
          onChange={onQueryChange}
          testId={`${testIdPrefix}-search`}
          className='h-8 w-[200px] max-sm:w-full'
        />
        <DropdownMenu
          align='end'
          renderTrigger={(p) => (
            <Button
              variant='secondary'
              className='h-8 rounded-lg px-2.5 text-xs'
              data-testid={`${testIdPrefix}-type-filter`}
              {...p}
            >
              {TYPE_ITEMS.find((i) => i.key === type)!.label}
              <ChevronDown size={12} />
            </Button>
          )}
          items={TYPE_ITEMS.map((i) => ({
            key: i.key,
            label: i.label,
            icon:
              type === i.key ? <Check size={14} /> : <span className='w-3.5' />,
            onSelect: () => onTypeChange(i.key),
          }))}
        />
        <DropdownMenu
          align='end'
          renderTrigger={(p) => (
            <Button
              variant='secondary'
              className='h-8 max-w-[150px] truncate rounded-lg px-2.5 text-xs'
              data-testid={`${testIdPrefix}-date-filter`}
              {...p}
            >
              {FILE_DATE_LABEL[date]}
              <ChevronDown size={12} />
            </Button>
          )}
          items={(Object.keys(FILE_DATE_LABEL) as DateFilter[]).map((k) => ({
            key: k,
            label: FILE_DATE_LABEL[k],
            icon: date === k ? <Check size={14} /> : <span className='w-3.5' />,
            onSelect: () => onDateChange(k),
          }))}
        />
        {onToggleLabel ? (
          <LabelMenu
            mode='filter'
            labels={labels}
            selectedIds={labelIds}
            onToggle={onToggleLabel}
            onClear={onClearLabels}
            canCreate={canCreateLabel}
            onCreate={onCreateLabel}
            testId={`${testIdPrefix}-label-filter`}
          />
        ) : null}
        <DropdownMenu
          align='end'
          renderTrigger={(p) => (
            <Button
              variant='secondary'
              className='h-8 max-w-[140px] truncate rounded-lg px-2.5 text-xs'
              data-testid={`${testIdPrefix}-sort`}
              {...p}
            >
              {FILE_SORT_LABEL[sort]}
              <ChevronDown size={12} />
            </Button>
          )}
          items={(Object.keys(FILE_SORT_LABEL) as SortMode[]).map((k) => ({
            key: k,
            label: FILE_SORT_LABEL[k],
            icon: sort === k ? <Check size={14} /> : <span className='w-3.5' />,
            onSelect: () => onSortChange(k),
          }))}
        />
        {filtersActive && (
          <Button
            type='button'
            variant='secondary'
            className='h-8 rounded-lg px-2.5 text-xs'
            data-testid={`${testIdPrefix}-reset-filters`}
            onClick={onReset}
            title='Reset filters'
          >
            <RotateCcw size={12} />
            Reset
          </Button>
        )}
        {hint ? (
          <span className='whitespace-nowrap text-[13px] text-[var(--jr-muted)] max-sm:hidden'>
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export interface FileListPaginationProps {
  hidden: number
  canCollapse: boolean
  testIdPrefix?: string
  onShowMore: () => void
  onCollapse: () => void
}

export function FileListPagination({
  hidden,
  canCollapse,
  testIdPrefix = 'files',
  onShowMore,
  onCollapse,
}: FileListPaginationProps) {
  if (hidden > 0) {
    return (
      <button
        type='button'
        onClick={onShowMore}
        data-testid={`${testIdPrefix}-show-more`}
        className='cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--jr-accent-hover)] hover:underline'
      >
        Show {hidden} more {hidden === 1 ? 'file' : 'files'}
      </button>
    )
  }
  if (canCollapse) {
    return (
      <button
        type='button'
        onClick={onCollapse}
        data-testid={`${testIdPrefix}-collapse`}
        className='cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--jr-accent-hover)] hover:underline'
      >
        Collapse
      </button>
    )
  }
  return null
}
