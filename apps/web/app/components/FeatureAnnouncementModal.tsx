'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FEATURE_ANNOUNCEMENTS,
  type FeatureAnnouncement,
} from '@/lib/feature-announcements'
import {
  getNextAnnouncement,
  markAnnouncementSeen,
} from '@/lib/feature-announcement-storage'

export function FeatureAnnouncementModal() {
  const [announcement, setAnnouncement] = useState<FeatureAnnouncement | null>(
    null
  )

  useEffect(() => {
    setAnnouncement(getNextAnnouncement(FEATURE_ANNOUNCEMENTS))
  }, [])

  if (!announcement) return null

  const dismiss = () => {
    markAnnouncementSeen(announcement.id)
    setAnnouncement(null)
  }

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200'>
      <div
        className={cn(
          'relative w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl',
          'animate-in zoom-in-95 duration-200'
        )}
        role='dialog'
        aria-modal='true'
        aria-labelledby='feature-announcement-title'
        aria-describedby='feature-announcement-message'
      >
        <div className='pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[#00B3B7]/25 blur-3xl' />
        <div className='pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl' />

        <button
          type='button'
          onClick={dismiss}
          className='absolute top-4 right-4 z-10 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white'
          aria-label='Dismiss announcement'
        >
          <X size={20} />
        </button>

        <div className='relative px-6 py-8 sm:px-10 sm:py-12'>
          <div className='mb-6 flex flex-wrap items-center gap-3'>
            {announcement.imageSrc ? (
              <div className='rounded-xl border border-white/10 bg-white p-2.5'>
                <Image
                  src={announcement.imageSrc}
                  alt={announcement.imageAlt || ''}
                  width={34}
                  height={34}
                  className='h-[34px] w-[34px]'
                  priority
                />
              </div>
            ) : null}
            {announcement.eyebrow ? (
              <span className='rounded-full border border-[#00B3B7]/30 bg-[#00B3B7]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300'>
                {announcement.eyebrow}
              </span>
            ) : null}
          </div>

          <h2
            id='feature-announcement-title'
            className='max-w-xl text-3xl font-bold tracking-tight sm:text-4xl'
          >
            {announcement.title}
          </h2>
          <p
            id='feature-announcement-message'
            className='mt-4 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg'
          >
            {announcement.message}
          </p>

          {announcement.highlights && announcement.highlights.length > 0 ? (
            <ul className='mt-8 grid gap-3 sm:grid-cols-3'>
              {announcement.highlights.map((item) => (
                <li
                  key={item}
                  className='flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200'
                >
                  <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00B3B7]/15 text-[#00B3B7]'>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          <div className='mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center'>
            {announcement.ctaHref && announcement.ctaLabel ? (
              <Link
                href={announcement.ctaHref}
                onClick={dismiss}
                className='inline-flex items-center justify-center rounded-xl bg-[#00B3B7] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#009ea1]'
              >
                {announcement.ctaLabel}
              </Link>
            ) : null}
            <button
              type='button'
              onClick={dismiss}
              className='inline-flex items-center justify-center rounded-xl border border-white/15 bg-transparent px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white'
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
