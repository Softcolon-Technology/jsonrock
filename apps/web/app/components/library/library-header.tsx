'use client'

import { ChevronDown, FilePlus, Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { DropdownMenu } from '../ui/dropdown-menu'
import type { DocType } from '@/types/library'

const NEW_FILE_ITEMS: { key: DocType; label: string }[] = [
  { key: 'json', label: 'JSON' },
  { key: 'text', label: 'Text' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'html', label: 'HTML' },
]

export interface LibraryHeaderProps {
  onNewProject: () => void
  onNewFile: (type: DocType) => void
  creatingFile?: boolean
}

export function LibraryHeader({
  onNewProject,
  onNewFile,
  creatingFile = false,
}: LibraryHeaderProps) {
  return (
    <div
      data-testid='library-header'
      className='flex flex-wrap items-end justify-between gap-4'
    >
      <div className='flex flex-col gap-1.5'>
        <h1 className='m-0 text-[28px] font-bold tracking-[-0.02em] max-sm:text-2xl'>
          Your library
        </h1>
        <p className='m-0 text-sm text-[var(--jr-muted)]'>
          Files and projects saved to your account. Local-only drafts stay on
          this device until you save while signed in.
        </p>
      </div>
      <div className='flex flex-wrap items-center gap-2.5'>
        <DropdownMenu
          align='end'
          menuTestId='jr-new-file-menu'
          renderTrigger={(props) => (
            <Button
              data-testid='jr-new-file'
              disabled={creatingFile}
              {...props}
            >
              <FilePlus size={16} />
              New file
              <ChevronDown size={14} />
            </Button>
          )}
          items={NEW_FILE_ITEMS.map((i) => ({
            key: i.key,
            label: i.label,
            testId: `jr-new-file-${i.key}`,
            disabled: creatingFile,
            onSelect: () => onNewFile(i.key),
          }))}
        />
        <Button
          variant='primary'
          data-testid='jr-new-project'
          onClick={onNewProject}
        >
          <Plus size={16} />
          New project
        </Button>
      </div>
    </div>
  )
}
