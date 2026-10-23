'use client'

import { FileText } from 'lucide-react'
import { useMemo } from 'react'
import { useFileListFilters } from '@/hooks/use-file-list-filters'
import { useLabels } from '@/hooks/use-labels'
import { mergeLabelCatalog } from '@/lib/label-catalog'
import type { FileLabel, RemoteFile } from '@/types/library'
import { EmptyState } from './empty-state'
import { FileListPagination, FileListToolbar } from './file-list-toolbar'
import { FileListRow } from './file-list-row'
import { FileListTable } from './file-list-table'

export interface StandaloneFilesListProps {
  files: RemoteFile[]
  /** Slug of a newly created file that should open in rename mode. */
  editingSlug?: string | null
  onRename: (file: RemoteFile, title: string) => Promise<void>
  onMove: (file: RemoteFile) => void
  onDelete: (file: RemoteFile) => void
  onEditingEnd?: () => void
  /** Optimistic local update after labels are saved. */
  onLabelsUpdated?: (slug: string, labels: FileLabel[]) => void
}

export function StandaloneFilesList({
  files,
  editingSlug = null,
  onRename,
  onMove,
  onDelete,
  onEditingEnd,
  onLabelsUpdated,
}: StandaloneFilesListProps) {
  const f = useFileListFilters(files)
  const labelsApi = useLabels(null)
  const catalog = useMemo(
    () => mergeLabelCatalog(labelsApi.labels, files),
    [labelsApi.labels, files]
  )

  const handleLabelsChange = async (file: RemoteFile, labelIds: string[]) => {
    const next = await labelsApi.assignToFile(file.slug, labelIds)
    onLabelsUpdated?.(file.slug, next)
  }

  const handleCreateLabel = async (name: string, color: string) => {
    await labelsApi.create(name, color)
  }

  return (
    <section data-testid='jr-standalone-list' className='flex flex-col gap-3.5'>
      <FileListToolbar
        totalCount={files.length}
        hint='Not in a project'
        testIdPrefix='library'
        query={f.query}
        type={f.type}
        sort={f.sort}
        date={f.date}
        filtersActive={f.filtersActive}
        onQueryChange={f.setQuery}
        onTypeChange={f.setType}
        onSortChange={f.setSort}
        onDateChange={f.setDate}
        onReset={f.resetFilters}
        labels={catalog}
        labelIds={f.labelIds}
        onToggleLabel={f.toggleLabelFilter}
        onClearLabels={() => f.setLabelIds([])}
        canCreateLabel
        onCreateLabel={handleCreateLabel}
      />

      {files.length === 0 ? (
        <EmptyState
          testId='files-empty-state'
          icon={<FileText size={20} />}
          description='No remote files yet — use New file above, or save from the editor while signed in.'
        />
      ) : f.sorted.length === 0 ? (
        <EmptyState
          testId='files-no-results'
          description={
            f.query.trim() || f.labelIds.length > 0
              ? f.query.trim()
                ? `No files match “${f.query.trim()}”.`
                : 'No files match the selected labels.'
              : 'No files match this filter.'
          }
        />
      ) : (
        <FileListTable label='Standalone files'>
          {f.visible.map((file) => (
            <FileListRow
              key={file.slug}
              file={file}
              context='library'
              initialEditing={editingSlug === file.slug}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
              onEditingEnd={
                editingSlug === file.slug ? onEditingEnd : undefined
              }
              availableLabels={catalog}
              onLabelsChange={handleLabelsChange}
              canCreateLabel
              onCreateLabel={handleCreateLabel}
            />
          ))}
        </FileListTable>
      )}

      <FileListPagination
        hidden={f.showAll ? 0 : f.hidden}
        canCollapse={f.canCollapse}
        testIdPrefix='library'
        onShowMore={() => f.setShowAll(true)}
        onCollapse={() => f.setShowAll(false)}
      />
    </section>
  )
}
