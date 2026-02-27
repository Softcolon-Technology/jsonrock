'use client'

/* eslint-disable react/prop-types -- using TypeScript interface for props */
import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'

interface ScrollToTopProps {
  className?: string
  size?: number
  offset?: number
  duration?: number
}

export const ScrollToTop: React.FC<ScrollToTopProps> = ({
  className = '',
  offset = 300,
  duration = 800,
}) => {
  const pathRef = useRef<SVGPathElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const progressPath = pathRef.current
    const button = buttonRef.current

    if (!progressPath || !button) return

    // Calculate path length
    const pathLength = progressPath.getTotalLength()

    // Set initial styles for progress path
    progressPath.style.strokeDasharray = `${pathLength} ${pathLength}`
    progressPath.style.strokeDashoffset = `${pathLength}`
    progressPath.style.transition = 'none' // Disable initial transition

    // Update progress based on scroll
    const updateProgress = () => {
      const scroll = window.scrollY || window.pageYOffset
      const height = document.documentElement.scrollHeight - window.innerHeight
      const progress = pathLength - (scroll * pathLength) / height

      // Ensure smooth updates without transition flicker
      progressPath.style.transition = 'none'
      progressPath.style.strokeDashoffset = `${progress}`
    }

    // Show/hide button based on scroll position
    const toggleVisibility = () => {
      const scrolled = window.scrollY || window.pageYOffset

      if (scrolled > offset) {
        if (!isVisible) {
          setIsVisible(true)
          button.style.opacity = '1'
          button.style.visibility = 'visible'
          button.style.transform = 'translateY(0px) scale(1)'
          button.style.transition =
            'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }
      } else {
        if (isVisible) {
          setIsVisible(false)
          button.style.opacity = '0'
          button.style.visibility = 'hidden'
          button.style.transform = 'translateY(20px) scale(0.8)'
          button.style.transition = 'all 0.3s ease-in-out'
        }
      }
    }

    // Handle scroll events
    const handleScroll = () => {
      updateProgress()
      toggleVisibility()
    }

    // Add scroll listener with throttling
    let ticking = false
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })
    // Initial call in case user starts scrolled down
    handleScroll()

    return () => {
      window.removeEventListener('scroll', throttledScroll)
    }
  }, [offset, isVisible])

  const scrollToTop = () => {
    const button = buttonRef.current
    const progressPath = pathRef.current

    if (!button || !progressPath) return

    // Animate button click
    button.style.transform = 'scale(0.85)'
    button.style.transition = 'transform 0.1s ease-in-out'

    setTimeout(() => {
      button.style.transform = 'scale(1)'
    }, 100)

    // Animate progress circle reverse
    const pathLength = progressPath.getTotalLength()
    progressPath.style.strokeDashoffset = `${pathLength}`
    progressPath.style.transition = `stroke-dashoffset ${duration / 1000}s ease-in-out`

    // Smooth scroll to top
    const startPosition = window.scrollY || window.pageYOffset
    const startTime = performance.now()

    const animateScroll = (currentTime: number) => {
      const timeElapsed = currentTime - startTime
      const progress = Math.min(timeElapsed / duration, 1)

      // Ease function (power2.inOut equivalent)
      const easeInOutQuad =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2

      const position = startPosition * (1 - easeInOutQuad)
      window.scrollTo(0, position)

      if (progress < 1) {
        requestAnimationFrame(animateScroll)
      }
    }

    requestAnimationFrame(animateScroll)
  }

  return (
    <button
      ref={buttonRef}
      onClick={scrollToTop}
      className={`fixed right-4 bottom-4 md:right-6 md:bottom-6 z-[100] group cursor-pointer opacity-0 invisible w-10 h-10 md:w-12 md:h-12 bg-white rounded-full shadow-lg hover:shadow-xl transition-all ${className}`}
      aria-label='Scroll to top'
    >
      {/* Progress Circle */}
      <svg
        className='absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none'
        viewBox='0 0 100 100'
      >
        {/* Background Circle */}
        <circle
          cx='50'
          cy='50'
          r='46'
          fill='none'
          stroke='rgba(0, 0, 0, 0.05)'
          strokeWidth='3'
        />
        {/* Progress Path */}
        <path
          ref={pathRef}
          d='M 50,50 m 0,-46 a 46,46 0 1,1 0,92 a 46,46 0 1,1 0,-92'
          fill='none'
          stroke='#00B3B7'
          strokeWidth='3'
          strokeLinecap='round'
          style={{ transition: 'none' }}
        />
      </svg>

      {/* Icon Container */}
      <div className='absolute inset-0 flex items-center justify-center'>
        <ArrowUp
          size={20}
          className='text-[#00B3B7] group-hover:scale-110 transition-transform duration-300'
        />
      </div>
    </button>
  )
}

export default ScrollToTop
