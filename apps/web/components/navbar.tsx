'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Menu,
  X,
  Sparkles,
  Monitor,
  Rocket,
  GitCompareArrows,
  Braces,
  File,
  FileText,
  Code2,
} from 'lucide-react'

type NavLink = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const EXPLORE_LINKS: NavLink[] = [
  { href: '#features', label: 'Features', icon: Sparkles },
  { href: '#showcase', label: 'Showcase', icon: Monitor },
]

const CREATE_LINKS: NavLink[] = [
  { href: '/editor', label: 'JSON Editor', icon: Braces },
  { href: '/editor/text', label: 'Text Editor', icon: File },
  { href: '/editor/markdown', label: 'Markdown Editor', icon: FileText },
  { href: '/editor/html', label: 'HTML Viewer', icon: Code2 },
  { href: '/diff', label: 'Diff Checker', icon: GitCompareArrows },
]

const COPYRIGHT_YEAR = 2026

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  // Avoid SSR/client markup drift for the mobile drawer (and stale HMR class mismatches)
  const [mounted, setMounted] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSmoothScroll = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (!href.startsWith('#')) {
      setIsOpen(false)
      return
    }

    e.preventDefault()
    const targetId = href.replace('#', '')
    const element = document.getElementById(targetId)

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }

    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = ''
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <header className='absolute top-0 w-full z-50 transition-all duration-300'>
      <div className='absolute inset-0 -z-10 border-b border-black/[0.06] bg-white/80 backdrop-blur-[10px]' />

      <div className='container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between relative z-10'>
        <Link href='/' className='flex items-center gap-2 relative z-50'>
          <Image
            src='/jsonrock-dark.svg'
            alt='JSONROCK'
            width={120}
            height={24}
            className='h-6 w-auto'
            priority
          />
        </Link>

        <nav className='hidden md:flex items-center gap-8'>
          {EXPLORE_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleSmoothScroll(e, link.href)}
              className='text-sm font-semibold text-zinc-800 hover:text-cyan-500 transition-colors cursor-pointer'
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className='hidden md:flex items-center gap-4'>
          <Link
            href='/editor?view=formatter'
            className='px-5 py-2.5 bg-[#00B3B7] hover:bg-[#009ea1] text-white text-sm font-semibold rounded-lg transition-all hover:shadow-lg'
          >
            Get Started
          </Link>
        </div>

        <button
          type='button'
          className='md:hidden relative z-50 p-2 -mr-2 text-zinc-600 cursor-pointer'
          onClick={() => setIsOpen((open) => !open)}
          aria-label='Open menu'
          aria-expanded={isOpen}
          aria-controls='mobile-site-menu'
        >
          <Menu size={24} />
        </button>
      </div>

      {mounted && (
        <>
          <div
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] md:hidden transition-opacity duration-300 ${
              isOpen
                ? 'opacity-100 visible'
                : 'opacity-0 invisible pointer-events-none'
            }`}
            onClick={() => setIsOpen(false)}
            aria-hidden={!isOpen}
          />

          <div
            id='mobile-site-menu'
            ref={sidebarRef}
            className={`fixed top-0 left-0 h-[100dvh] w-[min(280px,85vw)] bg-white shadow-2xl z-[60] md:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
              isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            role='dialog'
            aria-modal={isOpen || undefined}
            aria-hidden={!isOpen}
            aria-label='Site menu'
          >
            <div className='bg-gradient-to-br from-[#00B3B7] to-cyan-500 p-5 flex items-center justify-between shrink-0'>
              <h2 className='text-white font-bold text-lg'>Menu</h2>
              <button
                type='button'
                onClick={() => setIsOpen(false)}
                className='text-white hover:text-cyan-50 transition-colors cursor-pointer p-1'
                aria-label='Close menu'
              >
                <X size={22} />
              </button>
            </div>

            <div className='flex-1 min-h-0 overflow-y-auto overscroll-contain'>
              <section className='pt-4 pb-2'>
                <p className='px-5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400'>
                  Explore
                </p>
                <nav className='flex flex-col'>
                  {EXPLORE_LINKS.map((link) => {
                    const Icon = link.icon
                    return (
                      <a
                        key={link.label}
                        href={link.href}
                        onClick={(e) => handleSmoothScroll(e, link.href)}
                        className='flex items-center gap-3 px-5 py-3 text-zinc-700 hover:bg-[#00B3B7]/8 hover:text-[#00B3B7] transition-colors border-b border-zinc-100 cursor-pointer'
                      >
                        <Icon size={18} className='shrink-0 opacity-80' />
                        <span className='font-medium text-[15px]'>
                          {link.label}
                        </span>
                      </a>
                    )
                  })}
                </nav>
              </section>

              <section className='pt-3 pb-4'>
                <p className='px-5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400'>
                  Create & tools
                </p>
                <nav className='flex flex-col'>
                  {CREATE_LINKS.map((link) => {
                    const Icon = link.icon
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className='flex items-center gap-3 px-5 py-3 text-zinc-700 hover:bg-[#00B3B7]/8 hover:text-[#00B3B7] transition-colors border-b border-zinc-100 cursor-pointer'
                      >
                        <Icon size={18} className='shrink-0 opacity-80' />
                        <span className='font-medium text-[15px]'>
                          {link.label}
                        </span>
                      </Link>
                    )
                  })}
                </nav>
              </section>
            </div>

            <div className='p-4 border-t border-zinc-200 bg-zinc-50 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]'>
              <Link
                href='/editor?view=formatter'
                className='flex w-full items-center justify-center px-5 py-3 bg-[#00B3B7] hover:bg-[#009ea1] text-white text-sm font-semibold rounded-lg transition-all shadow-md active:scale-[0.98] mb-3 cursor-pointer'
                onClick={() => setIsOpen(false)}
              >
                <Rocket className='mr-2 h-4 w-4' />
                Get Started
              </Link>
              <p className='text-xs text-zinc-400 text-center'>
                © {COPYRIGHT_YEAR} JSON Rock Inc.
              </p>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
