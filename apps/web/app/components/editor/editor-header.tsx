import { ShareType } from '@/app/iterface'
import { cn } from '@/lib/utils'
import {
  Braces,
  File,
  FileText,
  Home,
  LinkIcon,
  UploadCloud,
} from 'lucide-react'
import { ThemeToggle } from '../button/theme-toggle'
import HeaderLogo from './header/header-logo'
import SaveStatus from './header/save-status'
import EditorActionBtn from '../button/editor-action-btn'
import Link from 'next/link'
import { FaGithub } from 'react-icons/fa6'

interface Props {
  documentType: ShareType
  documentSlug: string | null
  isJsonValid: boolean
  isAutoSaving: boolean
  currentViewMode: string
  onCreateNewDocument: (x: ShareType) => void
  onOpenShareModal: (x: boolean) => void
  onOpenUploadModal: (x: boolean) => void
}

const EditorHeader = ({
  documentType,
  documentSlug,
  isJsonValid,
  onOpenUploadModal,
  onCreateNewDocument,
  isAutoSaving,
  onOpenShareModal,
  currentViewMode,
}: Props) => {
  return (
    <header
      className={cn(
        'relative h-14 border-b border-zinc-200 flex items-center justify-between px-2 lg:px-6 bg-white shrink-0',
        documentType !== 'text' && 'dark:border-zinc-900 dark:bg-zinc-950'
      )}
    >
      {/* Left Zone: Identity & Context */}
      <div className='flex items-center gap-4 z-10'>
        <HeaderLogo
          type={documentType}
          slug={documentSlug}
          isValid={isJsonValid}
          viewMode={currentViewMode}
        />
      </div>

      {/* Center Zone: Primary Actions */}
      <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-2'>
        {/* Upload Button */}
        {documentType !== 'text' && (
          <EditorActionBtn
            onClick={() => onOpenUploadModal(true)}
            documentType={documentType}
            label='Upload'
            title={
              documentType === 'markdown' ? 'Upload Markdown' : 'Upload JSON'
            }
            icon={<UploadCloud size={14} />}
          />
        )}

        {/* New JSON */}
        <EditorActionBtn
          href='/editor'
          documentType={documentType}
          label='New JSON'
          title='Create New JSON'
          icon={<Braces size={14} />}
          isActive={documentType === 'json'}
        />

        {/* New Text */}
        <EditorActionBtn
          href='/editor/text'
          documentType={documentType}
          label='New Text'
          title='Create New Text Chat'
          icon={<File size={14} />}
          isActive={documentType === 'text'}
        />

        {/* New Markdown */}
        <EditorActionBtn
          href='/editor/markdown'
          documentType={documentType}
          label='New Markdown'
          title='Create New Markdown'
          icon={<FileText size={14} />}
          isActive={documentType === 'markdown'}
        />
      </div>

      {/* Mobile Actions (Visible only on small screens) */}
      <div className='flex md:hidden items-center gap-1.5'>
        <EditorActionBtn
          href={
            documentType === 'text'
              ? '/editor/text'
              : documentType === 'markdown'
                ? '/editor/markdown'
                : '/editor'
          }
          documentType={documentType}
          label='New'
          title='New File'
          icon={<File size={14} />}
        />
      </div>

      {/* Right Zone: Utility Actions */}
      <div className='flex items-center gap-2 z-10'>
        <SaveStatus isAutoSaving={isAutoSaving} documentType={documentType} />

        <div
          className={cn(
            'h-5 w-px bg-zinc-200 mx-1',
            documentType !== 'text' && 'dark:bg-zinc-800'
          )}
        />

        {/* Share Button (Icon Button) */}
        <button
          onClick={() => (!documentSlug ? undefined : onOpenShareModal(true))}
          disabled={!documentSlug}
          className={cn(
            'p-2 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none',
            !documentSlug
              ? // Disabled state
                'text-zinc-300 dark:text-zinc-600 cursor-not-allowed opacity-50'
              : // Enabled state
                cn(
                  'text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer',
                  documentType !== 'text' && 'dark:hover:text-emerald-400'
                )
          )}
          title={!documentSlug ? 'Save document first to share' : 'Share Link'}
          aria-label={
            !documentSlug
              ? 'Share Link (disabled - save document first)'
              : 'Share Link'
          }
        >
          <LinkIcon size={18} />
        </button>

        {/* Theme Toggle */}
        <div className={cn(documentType !== 'text' && 'dark:text-zinc-400')}>
          {documentType !== 'text' && <ThemeToggle />}
        </div>

        {/* Github */}
        <Link
          href='https://github.com/Softcolon-Technology/jsonrock'
          target='_blank'
          rel='noopener noreferrer'
          className={cn(
            'p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none',
            documentType !== 'text' &&
              'dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
          )}
          title='View Source on GitHub'
          aria-label='View Source on GitHub'
        >
          <FaGithub size={18} />
        </Link>

        {/* Home */}
        <Link
          href='/'
          className={cn(
            'p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none',
            documentType !== 'text' &&
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

export default EditorHeader
