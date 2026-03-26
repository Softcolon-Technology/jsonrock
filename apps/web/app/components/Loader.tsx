'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export const JsonRockLoader = ({
  className = 'w-12 h-12',
}: {
  className?: string
}) => {
  return (
    <img
      src='/jsonrock-loader.svg'
      alt='Loading...'
      className={`animate-spin ${className}`}
      style={{ animationDuration: '1.5s' }}
    />
  )
}

export const FullScreenLoader = () => {
  return (
    <div className='flex h-screen w-full items-center justify-center bg-gray-50/80 dark:bg-zinc-950/80 backdrop-blur-sm fixed inset-0 z-[100]'>
      <JsonRockLoader />
    </div>
  )
}

export const PortalFullScreenLoader = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className='flex items-center justify-center bg-white/40 dark:bg-zinc-950/40 backdrop-blur-[2px] fixed top-14 inset-x-0 bottom-0 z-[100]'>
      <JsonRockLoader />
    </div>,
    document.body
  )
}
