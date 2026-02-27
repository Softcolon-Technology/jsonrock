import React from 'react'
import { X, Copy, Check } from 'lucide-react'
import JsonEditor from './JsonEditor'

interface NodeModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    content: unknown
    path: string
  }
}

export const NodeModal = ({ isOpen, onClose, data }: NodeModalProps) => {
  const [copiedContent, setCopiedContent] = React.useState(false)
  const [copiedPath, setCopiedPath] = React.useState(false)

  if (!isOpen) return null

  const handleCopyContent = () => {
    navigator.clipboard.writeText(JSON.stringify(data.content, null, 2))
    setCopiedContent(true)
    setTimeout(() => setCopiedContent(false), 2000)
  }

  const handleCopyPath = () => {
    navigator.clipboard.writeText(data.path)
    setCopiedPath(true)
    setTimeout(() => setCopiedPath(false), 2000)
  }

  return (
    // Changed bg-black/50 to bg-black/10 for subtle dim, allowing context visibility
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/10 backdrop-blur-[1px] p-4 animate-in fade-in duration-200'>
      <div className='absolute inset-0' onClick={onClose} />

      <div className='bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl w-[90vw] max-w-[400px] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200'>
        {/* Header */}
        <div className='flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#27272a]'>
          <span className='text-[11px] font-semibold text-zinc-700 dark:text-zinc-300'>
            Content
          </span>
          <button
            onClick={onClose}
            className='p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          >
            <X size={14} />
          </button>
        </div>

        <div className='p-3 space-y-3'>
          {/* Content Section - No border, No radius */}
          <div className='space-y-1.5'>
            {/* Reverted bg to #1e1e1e as requested, explicit rounded-none */}
            <div className='relative group overflow-hidden bg-transparent rounded-none border-none'>
              <div className='absolute top-1.5 right-1.5 z-10'>
                <button
                  onClick={handleCopyContent}
                  className='p-1 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 rounded transition-colors'
                  title='Copy Content'
                >
                  {copiedContent ? (
                    <Check size={12} className='text-emerald-500' />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
              <div className='h-40 overflow-hidden text-[10px] !rounded-none !border-none !shadow-none'>
                <JsonEditor
                  defaultValue={JSON.stringify(data.content, null, 2)}
                  remoteValue={{
                    code: JSON.stringify(data.content, null, 2),
                    nonce: 0,
                  }}
                  readOnly={true}
                  onChange={() => {}}
                />
              </div>
            </div>
          </div>

          {/* JSON Path Section - No border, No radius */}
          <div className='space-y-1.5'>
            <label className='text-[10px] font-medium text-zinc-400 uppercase tracking-widest'>
              JSON Path
            </label>
            <div className='flex items-center justify-between bg-zinc-100 dark:bg-[#09090b] px-2.5 py-1.5'>
              <code className='text-[10px] text-emerald-600 dark:text-emerald-500 font-mono truncate mr-2'>
                {data.path}
              </code>
              <button
                onClick={handleCopyPath}
                className='text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors'
                title='Copy Path'
              >
                {copiedPath ? (
                  <Check size={12} className='text-emerald-500' />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
