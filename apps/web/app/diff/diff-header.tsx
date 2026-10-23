'use client'

import { cn } from '@/lib/utils'
import { GitCompareArrows, Braces, Code2, File, FileText } from 'lucide-react'
import HeaderLogo from '../components/editor/header/header-logo'
import EditorActionBtn from '../components/button/editor-action-btn'
import { AccountMenu } from '../components/account-menu'
import { InvitesBellMenu } from '../components/invites/invites-bell-menu'
import { isProjectsEnabled } from '@/lib/feature-flags'

interface DiffHeaderProps {
  isSaving?: boolean
}

const DiffHeader = ({ isSaving }: DiffHeaderProps) => {
  return (
    <header
      data-testid='diff-header'
      className={cn(
        'relative box-border flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-[var(--jr-border)] bg-[var(--jr-surface)] px-4 lg:px-7',
        'max-sm:h-auto max-sm:flex-wrap max-sm:gap-2 max-sm:py-2.5'
      )}
    >
      <div className='z-10 flex items-center gap-4'>
        <HeaderLogo
          type='json'
          slug={null}
          isValid={true}
          viewMode='formatter'
        />
      </div>

      <div className='absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 md:flex'>
        <EditorActionBtn
          href='/editor'
          documentType='json'
          label='New JSON'
          title='Create New JSON'
          icon={<Braces size={14} />}
        />
        <EditorActionBtn
          href='/editor/text'
          documentType='text'
          label='New Text'
          title='Create New Text Chat'
          icon={<File size={14} />}
        />
        <EditorActionBtn
          href='/editor/markdown'
          documentType='markdown'
          label='New Markdown'
          title='Create New Markdown'
          icon={<FileText size={14} />}
        />
        <EditorActionBtn
          href='/editor/html'
          documentType='html'
          label='New HTML'
          title='Create New HTML Viewer'
          icon={<Code2 size={14} />}
        />
        <EditorActionBtn
          href='/diff'
          documentType='json'
          label='Diff Checker'
          title='Diff Checker'
          icon={<GitCompareArrows size={14} />}
          isActive={true}
        />
      </div>

      <div className='flex items-center gap-1.5 md:hidden'>
        <EditorActionBtn
          href='/editor'
          documentType='json'
          label='Editor'
          title='Go to Editor'
          icon={<Braces size={14} />}
        />
      </div>

      <div className='z-10 flex items-center gap-2'>
        {isSaving && (
          <span className='animate-pulse text-xs text-[var(--jr-muted)]'>
            Saving…
          </span>
        )}
        {isProjectsEnabled ? <InvitesBellMenu /> : null}
        <AccountMenu />
      </div>
    </header>
  )
}

export default DiffHeader
