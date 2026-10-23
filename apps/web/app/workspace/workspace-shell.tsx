'use client'

import { SquarePen } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState, type ReactNode } from 'react'
import { isWorkspaceFileEditorPath } from '@/app/iterface'
import { AccountMenu } from '@/app/components/account-menu'
import { InviteProvider } from '@/app/components/invites/invite-provider'
import { cn } from '@/lib/utils'

const TABS = [
  {
    href: '/workspace',
    label: 'Workspace',
    match: (p: string) => p.startsWith('/workspace'),
  },
  {
    href: '/mcp',
    label: 'MCP',
    match: (p: string) => p === '/mcp' || p.startsWith('/mcp/'),
  },
]

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/workspace'
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const logoSrc =
    mounted && resolvedTheme === 'dark'
      ? '/jsonrock-light.svg'
      : '/jsonrock-dark.svg'

  // Project file editors have their own header — don't wrap with Workspace chrome.
  if (isWorkspaceFileEditorPath(pathname)) {
    return <InviteProvider>{children}</InviteProvider>
  }

  return (
    <InviteProvider>
      <div
        data-testid='workspace-shell'
        className='flex min-h-screen flex-col bg-[var(--jr-bg)] text-[14px] text-[var(--jr-text)]'
      >
        <header
          data-testid='workspace-topbar'
          className='box-border flex h-[60px] flex-wrap items-center justify-between gap-6 border-b border-[var(--jr-border)] bg-[var(--jr-surface)] px-7 max-sm:h-auto max-sm:gap-3 max-sm:px-4 max-sm:py-2.5'
        >
          <div className='flex items-center gap-7 max-sm:gap-4'>
            <Link
              href='/workspace'
              aria-label='JsonRock home'
              className='flex items-center gap-2 no-underline'
            >
              <Image
                src={logoSrc}
                alt='JsonRock'
                width={120}
                height={24}
                className='h-6 w-auto'
                priority
              />
            </Link>
            <nav aria-label='Workspace' className='flex items-center gap-1'>
              {TABS.map((tab) => {
                const active = tab.match(pathname)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`workspace-tab-${tab.label.toLowerCase()}`}
                    className={cn(
                      'rounded-[10px] px-3 py-2 no-underline transition-colors',
                      active
                        ? 'bg-[var(--jr-hover)] font-semibold text-[var(--jr-text)]'
                        : 'font-medium text-[var(--jr-text-2)] hover:bg-[var(--jr-hover)]'
                    )}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className='flex items-center gap-3'>
            <Link
              href='/editor'
              target='_blank'
              rel='noopener noreferrer'
              data-testid='workspace-open-editor'
              className='inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-3.5 font-semibold text-[var(--jr-text)] no-underline transition-colors hover:bg-[var(--jr-bg)]'
            >
              <SquarePen size={16} />
              Open editor
            </Link>
            <AccountMenu className='flex items-center' />
          </div>
        </header>
        <div className='flex-1'>{children}</div>
      </div>
    </InviteProvider>
  )
}
