'use client'

import React from 'react'

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: LegalLayoutProps) {
  return (
    <div className='min-h-screen bg-white text-[#1A1D1B] antialiased'>
      <main className='py-8 md:py-12'>
        <div className='container mx-auto px-6 max-w-4xl'>
          <header className='mb-8'>
            <h1 className='text-3xl md:text-4xl font-bold mb-2'>{title}</h1>
            <p className='text-zinc-500 text-sm'>Last updated: {lastUpdated}</p>
          </header>

          <div className='leading-relaxed space-y-1'>{children}</div>
        </div>
      </main>
    </div>
  )
}
