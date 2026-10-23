'use client'

import { UserButton } from '@clerk/nextjs'
import { Home, KeyRound, LayoutGrid, Moon, Sun } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaGithub } from 'react-icons/fa6'
import { useHomeHref } from '@/hooks/use-home-href'
import { signedInHomePath } from '@/lib/home'

const GITHUB_URL = 'https://github.com/Softcolon-Technology/jsonrock'

const CLERK_LIGHT = {
  colorBackground: '#ffffff',
  colorInputBackground: '#ffffff',
  colorInputText: '#0f172a',
  colorText: '#0f172a',
  colorTextSecondary: '#64748b',
  colorPrimary: '#00B3B7',
  colorNeutral: '#0f172a',
} as const

const CLERK_DARK = {
  colorBackground: '#18181b',
  colorInputBackground: '#27272a',
  colorInputText: '#fafafa',
  colorText: '#fafafa',
  colorTextSecondary: '#a1a1aa',
  colorPrimary: '#00B3B7',
  colorNeutral: '#fafafa',
} as const

export interface AccountMenuProps {
  /** Optional wrapper class (e.g. for test ids / spacing). */
  className?: string
  /**
   * Override Home action. Defaults to signed-in home (`/workspace` when
   * projects are on, else `/`).
   */
  onGoHome?: () => void
}

/**
 * Clerk UserButton with Workspace · MCP · theme · GitHub · Home.
 * Theme action drives next-themes for the whole app (not only Clerk chrome).
 */
export function AccountMenu({ className, onGoHome }: AccountMenuProps) {
  const router = useRouter()
  const homeHref = useHomeHref()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const darkMode = mounted && resolvedTheme === 'dark'

  const goHome = () => {
    if (onGoHome) onGoHome()
    else router.push(homeHref || signedInHomePath())
  }

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    // Flip the class immediately so the app shell updates in the same click
    // as the Clerk popover (next-themes otherwise waits a tick).
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [resolvedTheme, setTheme])

  const appearance = useMemo(
    () => ({
      variables: darkMode ? { ...CLERK_DARK } : { ...CLERK_LIGHT },
      elements: {
        userButtonPopoverCard:
          'border border-zinc-200 dark:border-zinc-800 shadow-lg',
      },
    }),
    [darkMode]
  )

  return (
    <div data-testid='jr-avatar' className={className}>
      <UserButton appearance={appearance}>
        <UserButton.MenuItems>
          <UserButton.Link
            label='Workspace'
            labelIcon={<LayoutGrid size={16} />}
            href='/workspace'
          />
          <UserButton.Link
            label='MCP tokens'
            labelIcon={<KeyRound size={16} />}
            href='/mcp'
          />
          <UserButton.Action
            label={darkMode ? 'Light theme' : 'Dark theme'}
            labelIcon={darkMode ? <Sun size={16} /> : <Moon size={16} />}
            onClick={toggleTheme}
          />
          <UserButton.Link
            label='View source on GitHub'
            labelIcon={<FaGithub size={16} />}
            href={GITHUB_URL}
          />
          <UserButton.Action
            label='Home'
            labelIcon={<Home size={16} />}
            onClick={goHome}
          />
        </UserButton.MenuItems>
      </UserButton>
    </div>
  )
}
