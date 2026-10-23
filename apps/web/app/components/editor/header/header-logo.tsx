'use client'

import { ShareType } from '@/app/iterface'
import { useHomeHref } from '@/hooks/use-home-href'
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  type: ShareType
  slug: string | null
  isValid: boolean
  viewMode: string
}

const HeaderLogo = ({ type, isValid }: Props) => {
  const homeHref = useHomeHref()

  return (
    <div className='flex items-center gap-2 sm:gap-3'>
      <Link
        href={homeHref}
        className='flex items-center hover:opacity-80 transition-opacity cursor-pointer'
        title='Go to Home'
        aria-label='JsonRock home'
      >
        <Image
          width={24}
          height={24}
          src='/jsonrock-dark.svg'
          alt='JSONROCK'
          className='h-5 sm:h-6 w-auto block dark:hidden'
        />
        <Image
          width={24}
          height={24}
          src='/jsonrock-light.svg'
          alt='JSONROCK'
          className='h-5 sm:h-6 w-auto hidden dark:block'
        />
      </Link>
      {!isValid && type === 'json' && (
        <span className='px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] sm:text-xs font-medium whitespace-nowrap'>
          Invalid
        </span>
      )}
    </div>
  )
}

export default HeaderLogo
