'use client'

import { cn } from '@/lib/utils'
import { GitCompareArrows, Braces, File, FileText, Home } from 'lucide-react'
import { ThemeToggle } from '../components/button/theme-toggle'
import HeaderLogo from '../components/editor/header/header-logo'
import EditorActionBtn from '../components/button/editor-action-btn'
import Link from 'next/link'
import { FaGithub } from 'react-icons/fa6'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PortalFullScreenLoader } from '../components/Loader'

interface DiffHeaderProps {
  isSaving?: boolean
}

const DiffHeader = ({ isSaving }: DiffHeaderProps) => {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <header
      className={cn(
        'relative h-14 border-b border-zinc-200 flex items-center justify-between px-2 lg:px-6 bg-white shrink-0',
        'dark:border-zinc-900 dark:bg-zinc-950'
      )}
    >
      {/* Left Zone: Identity */}
      <div className='flex items-center gap-4 z-10'>
        <HeaderLogo
          type='json'
          slug={null}
          isValid={true}
          viewMode='formatter'
        />
      </div>

      {/* Center Zone: Navigation */}
      <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-2'>
        {/* New JSON */}
        <EditorActionBtn
          href='/editor'
          documentType='json'
          label='New JSON'
          title='Create New JSON'
          icon={<Braces size={14} />}
        />

        {/* New Text */}
        <EditorActionBtn
          href='/editor/text'
          documentType='json'
          label='New Text'
          title='Create New Text Chat'
          icon={<File size={14} />}
        />

        {/* New Markdown */}
        <EditorActionBtn
          href='/editor/markdown'
          documentType='json'
          label='New Markdown'
          title='Create New Markdown'
          icon={<FileText size={14} />}
        />

        {/* Diff Checker (Active) */}
        <EditorActionBtn
          href='/diff'
          documentType='json'
          label='Diff Checker'
          title='JSON Diff Checker'
          icon={<GitCompareArrows size={14} />}
          isActive={true}
        />
      </div>

      {/* Mobile: simplified nav */}
      <div className='flex md:hidden items-center gap-1.5'>
        <EditorActionBtn
          href='/editor'
          documentType='json'
          label='Editor'
          title='Go to Editor'
          icon={<Braces size={14} />}
        />
      </div>

      {/* Right Zone: Utility Actions */}
      <div className='flex items-center gap-2 z-10'>
        {/* Save indicator */}
        {isSaving && (
          <span className='text-xs text-zinc-400 dark:text-zinc-500 animate-pulse'>
            Saving…
          </span>
        )}

        <div className='h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1' />

        {/* Theme Toggle */}
        <div className='dark:text-zinc-400'>
          <ThemeToggle />
        </div>

        {/* Github */}
        <Link
          href='https://github.com/Softcolon-Technology/jsonrock'
          target='_blank'
          rel='noopener noreferrer'
          className={cn(
            'p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none',
            'dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
          )}
          title='View Source on GitHub'
          aria-label='View Source on GitHub'
        >
          <FaGithub size={18} />
        </Link>

        {/* Home */}
        {isPending && <PortalFullScreenLoader />}
        <Link
          href='/'
          onClick={(e) => {
            e.preventDefault()
            startTransition(() => {
              router.push('/')
            })
          }}
          className={cn(
            'p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none',
            'dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
          )}
          title='Go to Home'
          aria-label='Go to Home'
        >
          <Home size={18} />
        </Link>
      </div>
    </header>
  )
}

export default DiffHeader
