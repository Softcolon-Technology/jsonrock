'use client'

import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderPlus,
  MoreHorizontal,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { DropdownMenu, type DropdownMenuItem } from '../ui/dropdown-menu'
import { RolePill } from '../ui/pill'
import { EditableTitle } from '../library/editable-title'
import { formatDate, pluralize } from '@/lib/library-format'
import { projectInitials, projectTone } from '@/lib/project-tone'
import type { DocType, Project } from '@/types/library'

const NEW_IN_PROJECT: { key: DocType; label: string }[] = [
  { key: 'json', label: 'JSON' },
  { key: 'text', label: 'Text' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'html', label: 'HTML' },
]

export interface ProjectHeaderProps {
  project: Project
  fileCount: number
  memberCount: number
  pendingInviteCount: number
  onRename: (name: string) => Promise<void>
  onAddExisting: () => void
  onNewFile: (type: DocType) => void
  onCopyLink: () => void
  onLeave?: () => void
  /** Disable create actions while a new file is being bootstrapped. */
  creatingFile?: boolean
}

export function ProjectHeader({
  project,
  fileCount,
  memberCount,
  pendingInviteCount,
  onRename,
  onAddExisting,
  onNewFile,
  onCopyLink,
  onLeave,
  creatingFile = false,
}: ProjectHeaderProps) {
  const isOwner = project.role === 'owner'
  const canAdd = project.role !== 'viewer'
  const tone = projectTone(project.id)
  const [draft, setDraft] = useState(project.name)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(project.name), [project.name])

  const commit = async () => {
    const next = draft.trim()
    if (!isOwner || next === project.name) {
      setDraft(project.name)
      return
    }
    if (!next) {
      setDraft(project.name)
      setError('Project name can’t be empty')
      return
    }
    try {
      setError(null)
      await onRename(next)
    } catch (e) {
      setDraft(project.name)
      setError(e instanceof Error ? e.message : 'Could not rename project')
    }
  }

  const menu: DropdownMenuItem[] = [
    {
      key: 'copy',
      label: 'Copy project link',
      onSelect: onCopyLink,
      testId: 'project-copy-link',
    },
    ...(!isOwner && onLeave
      ? [
          {
            key: 'leave',
            label: 'Leave project',
            danger: true,
            onSelect: onLeave,
            testId: 'project-menu-leave',
          },
        ]
      : []),
  ]

  const meta = [
    pluralize(fileCount, 'file'),
    pluralize(memberCount, 'member'),
    ...(isOwner && pendingInviteCount > 0
      ? [pluralize(pendingInviteCount, 'pending invite')]
      : []),
    ...(project.createdAt
      ? [`created ${formatDate(project.createdAt)}`]
      : [`updated ${formatDate(project.updatedAt)}`]),
    ...(isOwner ? ['Click the name to rename'] : []),
  ].join(' · ')

  return (
    <div data-testid='project-header' className='flex flex-col gap-3.5'>
      <nav
        aria-label='Breadcrumb'
        className='flex items-center gap-2 text-[13px] text-[var(--jr-muted)]'
      >
        <Link
          href='/workspace'
          className='font-medium text-[var(--jr-muted)] no-underline hover:text-[var(--jr-text)]'
        >
          Workspace
        </Link>
        <ChevronRight size={14} aria-hidden='true' />
        <span className='font-medium text-[var(--jr-text)]'>
          {project.name}
        </span>
      </nav>

      <div className='flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-start gap-3 sm:items-center sm:gap-3.5'>
          <div
            className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold'
            style={{ background: tone.bg, color: tone.fg }}
            title={project.name}
            aria-label={project.name}
          >
            {projectInitials(project.name)}
          </div>
          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <div className='flex flex-wrap items-center gap-2.5'>
              <EditableTitle
                variant='heading'
                label='Project name'
                value={draft}
                onChange={setDraft}
                onSubmit={commit}
                onCancel={() => setDraft(project.name)}
                readOnly={!isOwner}
                testId='jr-project-name'
              />
              {/* {isOwner ? (
                <RolePill role='owner' data-testid='jr-project-role'>
                  You are owner
                </RolePill>
              ) : (
                <RolePill role={project.role} data-testid='jr-project-role' />
              )} */}
            </div>
            {error ? (
              <span
                role='alert'
                className='text-[13px] text-[var(--jr-danger)]'
              >
                {error}
              </span>
            ) : (
              <span className='text-[13px] leading-snug text-[var(--jr-muted)]'>
                {meta}
              </span>
            )}
          </div>
        </div>

        <div className='flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end'>
          {canAdd && (
            <>
              <Button
                onClick={onAddExisting}
                data-testid='jr-add-existing'
                className='max-sm:flex-1'
              >
                <FolderPlus size={16} />
                <span className='max-[380px]:hidden'>Add existing</span>
                <span className='min-[381px]:hidden'>Add</span>
              </Button>
              <DropdownMenu
                align='end'
                menuTestId='jr-new-in-project-menu'
                items={NEW_IN_PROJECT.map((item) => ({
                  key: item.key,
                  label: item.label,
                  testId: `jr-new-in-project-${item.key}`,
                  disabled: creatingFile,
                  onSelect: () => onNewFile(item.key),
                }))}
                renderTrigger={(props) => (
                  <Button
                    variant='primary'
                    data-testid='jr-new-in-project'
                    disabled={creatingFile}
                    className='max-sm:flex-1'
                    {...props}
                  >
                    <FilePlus size={16} />
                    New file
                    <ChevronDown size={14} />
                  </Button>
                )}
              />
            </>
          )}
          <DropdownMenu
            align='end'
            items={menu}
            renderTrigger={(p) => (
              <Button
                aria-label='More project actions'
                className='w-10 shrink-0 px-0 text-[#334155]'
                data-testid='project-more-actions'
                {...p}
              >
                <MoreHorizontal size={18} />
              </Button>
            )}
          />
        </div>
      </div>
    </div>
  )
}
