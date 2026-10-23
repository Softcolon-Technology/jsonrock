'use client'

import { Home, LayoutGrid, LinkIcon, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { FaGithub } from 'react-icons/fa6'
import { AccountMenu } from '../../account-menu'
import { InvitesBellMenu } from '../../invites/invites-bell-menu'
import { ThemeToggle } from '../../button/theme-toggle'
import { cn } from '@/lib/utils'

export interface HeaderActionsProps {
  isSignedIn: boolean
  documentSlug: string | null
  isAutoSaving: boolean
  onOpenShare: () => void
  /** Same handler the old Home icon used. */
  onGoHome: () => void
}

const GITHUB_URL = 'https://github.com/Softcolon-Technology/jsonrock'

const outlineBtn =
  'inline-flex h-9 cursor-pointer items-center gap-[7px] rounded-[10px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-3 text-[13px] font-semibold text-[var(--jr-text)] transition-colors hover:bg-[var(--jr-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 max-md:px-2.5'

const iconBtn =
  'relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-[var(--jr-muted)] transition-colors hover:bg-[var(--jr-hover)] hover:text-[var(--jr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'

/** Workspace · Share · divider · bell (invites) · avatar (account menu). */
export function HeaderActions({
  isSignedIn,
  documentSlug,
  isAutoSaving,
  onOpenShare,
  onGoHome,
}: HeaderActionsProps) {
  const shareDisabled = !documentSlug || isAutoSaving

  return (
    <>
      <Link
        href='/workspace'
        data-testid='jr-workspace-btn'
        className={cn(outlineBtn, 'no-underline')}
        title='Workspace — files and projects'
        aria-label='Workspace'
      >
        <LayoutGrid size={15} aria-hidden='true' />
        <span className='max-md:hidden'>Workspace</span>
      </Link>

      <button
        type='button'
        data-testid='jr-share-btn'
        onClick={() => (shareDisabled ? undefined : onOpenShare())}
        disabled={shareDisabled}
        className={outlineBtn}
        title={
          !documentSlug
            ? 'Save document first to share'
            : isAutoSaving
              ? 'Saving changes...'
              : 'Share Link'
        }
        aria-label={
          !documentSlug
            ? 'Share Link (disabled - save document first)'
            : isAutoSaving
              ? 'Saving changes...'
              : 'Share Link'
        }
      >
        {isAutoSaving && documentSlug ? (
          <Loader2 size={15} className='animate-spin' aria-hidden='true' />
        ) : (
          <LinkIcon size={15} aria-hidden='true' />
        )}
        <span className='max-md:hidden'>Share</span>
      </button>

      <div
        aria-hidden='true'
        className='mx-0.5 h-6 w-px bg-[var(--jr-border)] dark:bg-zinc-800'
      />

      {isSignedIn ? (
        <>
          <InvitesBellMenu />
          <AccountMenu
            className='ml-0.5 flex items-center'
            onGoHome={onGoHome}
          />
        </>
      ) : (
        // Signed out: no account menu, so keep the utilities reachable.
        <div className='flex items-center gap-0.5'>
          <div className='dark:text-zinc-400'>
            <ThemeToggle />
          </div>
          <Link
            href='/mcp'
            className={iconBtn}
            title='MCP — create a token for AI agents'
            aria-label='MCP tokens'
          >
            <Image
              src='/mcp.png'
              alt=''
              width={18}
              height={18}
              className='h-[18px] w-[18px] invert dark:invert-0'
            />
          </Link>
          <Link
            href={GITHUB_URL}
            target='_blank'
            rel='noopener noreferrer'
            className={cn(iconBtn, 'max-md:hidden')}
            title='View Source on GitHub'
            aria-label='View Source on GitHub'
          >
            <FaGithub size={18} />
          </Link>
          <button
            type='button'
            onClick={onGoHome}
            className={cn(iconBtn, 'max-sm:hidden')}
            title='Go to Home'
            aria-label='Go to Home'
          >
            <Home size={18} />
          </button>
        </div>
      )}
    </>
  )
}
