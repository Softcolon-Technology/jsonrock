'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { LeftHeroAnimation, RightHeroAnimation } from './hero-animations'

export default function HeroSection() {
  return (
    <section className='relative  min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden'>
      {/* Subtle Grid Pattern */}
      {/* Grid Pattern Background */}
      <div className='absolute -top-3/5 left-1/2 -translate-x-1/2 -translate-y-1/2 inset-0 z-0'>
        <div
          className='absolute inset-0'
          style={{
            backgroundImage: `url('/grid-pattern.png')`,
            backgroundSize: 'auto',
            backgroundRepeat: 'repeat',
          }}
        />
      </div>

      {/* Hero Content */}
      <div className='container mx-auto px-4 lg:px-8 relative z-10 pt-12 pb-16 pt-32 md:pb-32'>
        <div className='max-w-7xl mx-auto'>
          {/* Text Content */}
          <div className='text-center space-y-6 mb-12'>
            {/* Main Title */}
            <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold leading-tighter'>
              <span className='text-[#1A1D1B]'>JSON Rock: </span>
              <span className='text-[#00B3B7]'>Visualize Data</span>
              <br />
              <span className='text-[#1A1D1B]'>Like Never Before</span>
            </h1>

            {/* Description */}
            <p className='text-base md:text-lg text-[#1A1D1B] max-w-[663px] mx-auto leading-tight px-4'>
              Transform messy JSON into beautiful, interactive graphs instantly.
              <br />
              The ultimate tool for developers to map, format, and edit complex
              data structures.
            </p>
          </div>

          {/* Hero Image */}
          <div className='relative max-w-4xl mx-auto mt-16'>
            <LeftHeroAnimation />
            <RightHeroAnimation />
            <div className='blur-[97px] z-[-10] bg-[#00B3B7] w-[80%] md:w-[85%] aspect-[2.77/1] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'></div>
            <Image
              src='/hero3.gif'
              alt='JSONRock Editor Interface'
              width={0}
              height={0}
              sizes='100vw'
              style={{ width: '100%', height: 'auto' }}
              className='z-10 rounded-[10px] border border-[#BDE7E8] shadow-[0px_16px_16px_-10px_#82C9CA]'
              priority
              unoptimized
            />
          </div>
        </div>
      </div>
    </section>
  )
}
