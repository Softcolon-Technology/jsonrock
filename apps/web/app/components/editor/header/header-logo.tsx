'use client'

import { ShareType } from '@/app/iterface'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface Props {
  type: ShareType
  slug: string | null
  isValid: boolean
  viewMode: string
}

const HeaderLogo = ({ type, slug, isValid, viewMode }: Props) => {
  const onClickNavigation = slug
    ? type === 'text'
      ? `/editor/text/${slug}`
      : type === 'markdown'
        ? `/editor/markdown/${slug}`
        : type === 'html'
          ? `/editor/html/${slug}`
          : `/editor/${slug}?view=${viewMode}`
    : `?view=${viewMode}`

  const handleLogoClick = () => {
    window.location.href = onClickNavigation
  }

  return (
    <div className='flex items-center gap-2 sm:gap-3'>
      <div
        onClick={handleLogoClick}
        className='flex items-center hover:opacity-80 transition-opacity cursor-pointer'
        title='Refresh Page'
        role='button'
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleLogoClick()
          }
        }}
      >
        <Image
          width={24}
          height={24}
          src='/jsonrock-dark.svg'
          alt='JSONROCK'
          className={cn(
            'h-5 sm:h-6 w-auto',
            type !== 'text' ? 'block dark:hidden' : 'block'
          )}
        />
        <Image
          width={24}
          height={24}
          src='/jsonrock-light.svg'
          alt='JSONROCK'
          className={cn(
            'h-5 sm:h-6 w-auto',
            type !== 'text' ? 'hidden dark:block' : 'hidden'
          )}
        />
      </div>
      {!isValid && type === 'json' && (
        <span className='px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] sm:text-xs font-medium whitespace-nowrap'>
          Invalid
        </span>
      )}
    </div>
  )
}

export default HeaderLogo
