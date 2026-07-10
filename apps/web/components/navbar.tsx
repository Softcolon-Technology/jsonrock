'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Menu,
  X,
  Sparkles,
  Monitor,
  Wrench,
  Star,
  Rocket,
  GitCompareArrows,
} from 'lucide-react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Smooth scroll handler (only for anchor links)
  const handleSmoothScroll = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    // Route links (e.g. /diff) — let the browser navigate normally
    if (!href.startsWith('#')) return

    e.preventDefault()
    const targetId = href.replace('#', '')
    const element = document.getElementById(targetId)

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }

    // Close mobile menu if open
    setIsOpen(false)
  }

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const navLinks = [
    { href: '#features', label: 'Features', icon: Sparkles },
    { href: '#showcase', label: 'Showcase', icon: Monitor },
    { href: '/diff', label: 'Diff Checker', icon: GitCompareArrows },
  ]

  return (
    <header className='absolute top-0 w-full z-50 transition-all duration-300'>
      {/* Header Background */}
      <div
        className='absolute inset-0 -z-10'
        style={{
          background: 'rgba(255, 255, 255, 0.8)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          backdropFilter: 'blur(10px)',
        }}
      />

      <div className='container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between relative z-10'>
        {/* Logo */}
        <div
          className='flex items-center gap-2 relative z-50 cursor-pointer'
          onClick={() => (window.location.href = '/')}
        >
          <Image
            src='/jsonrock-dark.svg'
            alt='JSONROCK'
            width={120}
            height={24}
            className='h-6 w-auto'
            priority
          />
        </div>

        {/* Desktop Navigation */}
        <nav className='hidden md:flex items-center gap-8'>
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleSmoothScroll(e, link.href)}
              style={{ color: '#27272a' }} // Ensure dark color is always applied
              className='text-sm font-semibold hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors cursor-pointer'
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className='hidden md:flex items-center gap-4'>
          <Link
            href='/editor?view=formatter'
            className='px-5 py-2.5 bg-[#00B3B7] hover:bg-[#00B3B7] text-white text-sm font-semibold rounded-lg transition-all hover:shadow-lg'
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className='md:hidden relative z-50 p-2 -mr-2 text-zinc-600'
          onClick={() => setIsOpen(!isOpen)}
          aria-label='Toggle menu'
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Mobile Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-[100dvh] w-[280px] bg-white shadow-2xl z-[60] md:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className='bg-gradient-to-br from-[#00B3B7] to-cyan-500 p-6 flex items-center justify-between shrink-0'>
          <h2 className='text-white font-bold text-xl'>Menu</h2>
          <button
            onClick={() => setIsOpen(false)}
            className='text-white hover:text-cyan-50 transition-colors'
            aria-label='Close menu'
          >
            <X size={24} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className='py-6 flex flex-col overflow-y-auto'>
          {navLinks.map((link, index) => {
            const Icon = link.icon
            return (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleSmoothScroll(e, link.href)}
                className='flex items-center gap-4 px-6 py-4 text-zinc-700 hover:bg-gradient-to-r hover:from-[#00B3B7]/10 hover:to-cyan-500/10 hover:text-[#00B3B7] transition-all duration-200 group border-b border-zinc-100 last:border-0 cursor-pointer'
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Icon className='text-2xl group-hover:scale-110 transition-transform duration-200' />
                <span className='font-medium text-lg'>{link.label}</span>
              </a>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className='p-6 border-t border-gray-200 bg-gray-50 mt-auto shrink-0'>
          <Link
            href='/editor?view=formatter'
            className='flex w-full items-center justify-center px-6 py-3 bg-[#00B3B7] hover:bg-[#00B0B4] text-white text-base font-semibold rounded-lg transition-all shadow-md active:scale-95 mb-4'
            onClick={() => setIsOpen(false)}
          >
            <Rocket className='mr-2 h-5 w-5' />
            Get Started
          </Link>
          <p className='text-sm text-gray-400 text-center'>
            © {new Date().getFullYear()} JSON Rock Inc.
          </p>
        </div>
      </div>
    </header>
  )
}
