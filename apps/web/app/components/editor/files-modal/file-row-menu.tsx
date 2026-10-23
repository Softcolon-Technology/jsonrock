'use client'

import { FolderInput, Link2, MoreHorizontal, Pencil } from 'lucide-react'
import { DropdownMenu, type DropdownMenuItem } from '../../ui/dropdown-menu'
import type { RemoteFile } from '@/types/library'

export interface FileRowMenuProps {
  file: RemoteFile
  /** Rename / move are allowed (owner or editor). */
  canEdit: boolean
  onRename: () => void
  onMove: () => void
  onCopyLink: () => void
}

/** ⋯ menu: Rename · Move to project… · Copy share link (Delete is a separate button). */
export function FileRowMenu({
  file,
  canEdit,
  onRename,
  onMove,
  onCopyLink,
}: FileRowMenuProps) {
  const slug = file.slug
  const items: DropdownMenuItem[] = [
    ...(canEdit
      ? [
          {
            key: 'rename',
            label: 'Rename',
            icon: <Pencil size={15} />,
            onSelect: onRename,
            testId: `jr-row-rename-${slug}`,
          },
          {
            key: 'move',
            label: 'Move to project…',
            icon: <FolderInput size={15} />,
            onSelect: onMove,
            testId: `jr-row-move-${slug}`,
          },
        ]
      : []),
    {
      key: 'copy',
      label: 'Copy share link',
      icon: <Link2 size={15} />,
      onSelect: onCopyLink,
      testId: `jr-row-copy-link-${slug}`,
    },
  ]

  return (
    <DropdownMenu
      items={items}
      align='end'
      menuClassName='w-[220px]'
      renderTrigger={(trigger) => (
        <button
          type='button'
          {...trigger}
          aria-label={`More actions for ${file.title}`}
          title='More actions'
          data-testid={`jr-file-row-menu-${slug}`}
          className='inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-[#e2e8f0] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] aria-expanded:bg-[#e2e8f0] aria-expanded:text-[var(--jr-text)]'
        >
          <MoreHorizontal size={18} aria-hidden='true' />
        </button>
      )}
    />
  )
}
