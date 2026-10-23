'use client'

import { FileText } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState } from '../library/empty-state'
import {
  FileListPagination,
  FileListToolbar,
} from '../library/file-list-toolbar'
import { FileListRow } from '../library/file-list-row'
import { FileListTable } from '../library/file-list-table'
import { useFileListFilters } from '@/hooks/use-file-list-filters'
import { useLabels } from '@/hooks/use-labels'
import { mergeLabelCatalog } from '@/lib/label-catalog'
import type { FileLabel, RemoteFile, Role } from '@/types/library'

export interface ProjectFilesSectionProps {
  files: RemoteFile[]
  role: Role
  projectId: string
  /** Slug of a newly created file that should open in rename mode. */
  editingSlug?: string | null
  onRename: (file: RemoteFile, title: string) => Promise<void>
  onMoveOut: (file: RemoteFile) => void
  onDelete: (file: RemoteFile) => void
  onEditingEnd?: () => void
  onLabelsUpdated?: (slug: string, labels: FileLabel[]) => void
}

export function ProjectFilesSection({
  files,
  role,
  projectId,
  editingSlug = null,
  onRename,
  onMoveOut,
  onDelete,
  onEditingEnd,
  onLabelsUpdated,
}: ProjectFilesSectionProps) {
  const f = useFileListFilters(files)
  const labelsApi = useLabels(projectId)
  const catalog = useMemo(
    () => mergeLabelCatalog(labelsApi.labels, files),
    [labelsApi.labels, files]
  )
  const canEdit = role === 'owner' || role === 'editor'
  const canCreateLabel = role === 'owner'

  const handleLabelsChange = async (file: RemoteFile, labelIds: string[]) => {
    const next = await labelsApi.assignToFile(file.slug, labelIds)
    onLabelsUpdated?.(file.slug, next)
  }

  const handleCreateLabel = async (name: string, color: string) => {
    await labelsApi.create(name, color)
  }

  return (
    <div data-testid='project-files-section' className='flex flex-col gap-3'>
      <FileListToolbar
        totalCount={files.length}
        testIdPrefix='project'
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
        canCreateLabel={canCreateLabel}
        onCreateLabel={canCreateLabel ? handleCreateLabel : undefined}
      />

      {files.length === 0 ? (
        <EmptyState
          testId='project-files-empty'
          icon={<FileText size={20} />}
          description={
            canEdit
              ? 'No files in this project yet — add an existing file or create a new one.'
              : 'No files in this project yet.'
          }
        />
      ) : f.sorted.length === 0 ? (
        <EmptyState
          testId='project-files-no-results'
          description={
            f.query.trim() || f.labelIds.length > 0
              ? f.query.trim()
                ? `No files match “${f.query.trim()}”.`
                : 'No files match the selected labels.'
              : 'No files match this filter.'
          }
        />
      ) : (
        <FileListTable label='Project files'>
          {f.visible.map((file) => (
            <FileListRow
              key={file.slug}
              file={file}
              context='project'
              canEdit={canEdit}
              initialEditing={editingSlug === file.slug}
              onRename={onRename}
              onMove={onMoveOut}
              onDelete={onDelete}
              onEditingEnd={
                editingSlug === file.slug ? onEditingEnd : undefined
              }
              availableLabels={catalog}
              onLabelsChange={canEdit ? handleLabelsChange : undefined}
              canCreateLabel={canCreateLabel}
              onCreateLabel={canCreateLabel ? handleCreateLabel : undefined}
            />
          ))}
        </FileListTable>
      )}

      <FileListPagination
        hidden={f.showAll ? 0 : f.hidden}
        canCollapse={f.canCollapse}
        testIdPrefix='project'
        onShowMore={() => f.setShowAll(true)}
        onCollapse={() => f.setShowAll(false)}
      />
    </div>
  )
}
