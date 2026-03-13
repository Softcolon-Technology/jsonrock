import React, { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  isOpen: boolean
  message: string
  onClose: () => void
  duration?: number
  forceLightMode?: boolean
}

export const Toast = ({
  isOpen,
  message,
  onClose,
  duration = 3000,
  forceLightMode,
}: ToastProps) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-[200] flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border animate-in slide-in-from-top-4 fade-in duration-300',
        forceLightMode
          ? 'bg-white border-zinc-200 text-zinc-900'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100'
      )}
    >
      <CheckCircle2 className='w-5 h-5 text-emerald-500' />
      <p className='text-sm font-medium'>{message}</p>
      <button
        onClick={onClose}
        className={cn(
          'ml-4 p-1 rounded-md text-zinc-400 hover:text-zinc-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          !forceLightMode && 'dark:hover:text-zinc-200'
        )}
      >
        <X size={16} />
      </button>
    </div>
  )
}
