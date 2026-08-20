import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FaInstagram, FaLinkedinIn } from 'react-icons/fa'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className='bg-white pt-12 pb-8 border-t border-zinc-200'>
      <div className='max-w-7xl mx-auto px-6'>
        {/* Top Row: Logo & Socials */}
        <div className='flex flex-row justify-between items-center gap-4 mb-8 md:mb-10'>
          <Link href='/' className='flex items-center shrink-0'>
            <Image
              src='/jsonrock-dark.svg'
              alt='JsonRock'
              width={100}
              height={30}
              className='h-5 md:h-8 w-auto'
            />
          </Link>

          <div className='flex items-center space-x-4 md:space-x-6 text-[#333333]'>
            <Link
              href='https://www.instagram.com/softcolon_technologies/'
              target='_blank'
              rel='noopener noreferrer'
            >
              <FaInstagram
                size={20}
                className='hover:text-[#00B3B7] transition-all hover:scale-110 transform'
              />
            </Link>
            <Link
              href='https://www.linkedin.com/company/softcolon/'
              target='_blank'
              rel='noopener noreferrer'
            >
              <FaLinkedinIn
                size={20}
                className='hover:text-[#00B3B7] transition-all hover:scale-110 transform'
              />
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className='h-px w-full bg-zinc-100 mb-8' />

        {/* Bottom Row: Copyright, Credits, Legal */}
        <div className='flex flex-col md:flex-row justify-between items-center gap-6 text-[12px] md:text-[13px] text-zinc-500 font-medium'>
          <div className='order-3 md:order-1 text-center md:text-left'>
            © {currentYear} JsonRock. All rights reserved.
          </div>

          <div className='order-1 md:order-2 flex items-center justify-center gap-1.5 md:absolute md:left-1/2 md:-translate-x-1/2'>
            <span>Made by</span>
            <Link
              href='https://www.softcolon.com/'
              target='_blank'
              rel='noopener noreferrer'
              className='text-zinc-900 font-bold hover:text-[#00B3B7] transition-colors'
            >
              Softcolon
            </Link>
          </div>

          <div className='order-2 md:order-3 flex items-center justify-center gap-6 md:gap-8'>
            <Link
              href='/privacy-policy'
              className='hover:text-[#00B3B7] transition-colors whitespace-nowrap'
            >
              Privacy Policy
            </Link>
            <Link
              href='/terms'
              className='hover:text-[#00B3B7] transition-colors whitespace-nowrap'
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
