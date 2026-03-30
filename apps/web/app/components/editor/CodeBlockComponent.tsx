'use client'

import React, { useState } from 'react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const CodeBlockComponent = ({
  node,
  updateAttributes,
  extension,
}: any) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const text = node.textContent
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <NodeViewWrapper className='relative group my-4'>
      <div className='absolute right-3 top-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity'>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-200/80 hover:bg-zinc-300/90 text-zinc-700 text-[10px] font-medium transition-all backdrop-blur-sm border border-zinc-300/50 shadow-sm',
            'dark:bg-zinc-800/80 dark:hover:bg-zinc-700/90 dark:text-zinc-300 dark:border-zinc-600/50'
          )}
          title='Copy code'
        >
          {copied ? (
            <>
              <Check className='w-3 h-3 text-emerald-500' />
              <span className='text-emerald-500'>Copied</span>
            </>
          ) : (
            <>
              <Copy className='w-3 h-3' />
              {/* <span>Copy</span> */}
            </>
          )}
        </button>
      </div>

      <pre
        className={cn(
          'page-code-block not-prose bg-zinc-100 text-zinc-800 p-4 pt-12 rounded-md border border-zinc-200 font-mono text-sm shadow-sm block overflow-x-auto min-h-[3rem]',
          'dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200'
        )}
      >
        <code className='min-h-12'>
          <NodeViewContent />
        </code>
      </pre>
    </NodeViewWrapper>
  )
}
