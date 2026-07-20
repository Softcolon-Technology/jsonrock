import { ShareType } from '@/app/iterface'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'

interface SaveStatusProps {
  isAutoSaving: boolean
  documentType: ShareType
}

const SaveStatus = ({ isAutoSaving, documentType }: SaveStatusProps) => {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-1.5 sm:px-3 text-xs font-medium text-zinc-500 select-none',
        documentType !== 'text' && 'dark:text-zinc-400'
      )}
      title={isAutoSaving ? 'Saving...' : 'Saved'}
    >
      {isAutoSaving ? (
        <span className='flex items-center gap-1.5'>
          <Loader2 size={14} className='animate-spin text-zinc-400' />
          <span className='hidden sm:inline'>Saving...</span>
        </span>
      ) : (
        <span className='flex items-center gap-1.5'>
          <Check size={14} className='text-emerald-500' />
          <span className='hidden sm:inline'>Saved</span>
        </span>
      )}
    </div>
  )
}

export default SaveStatus
