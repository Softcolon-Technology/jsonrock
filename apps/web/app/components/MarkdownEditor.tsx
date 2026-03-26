'use client'

import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { UploadCloud, Download } from 'lucide-react'

const handleMarkdownDownload = async (
  content: string,
  requestedFilename: string
) => {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: requestedFilename,
        types: [
          {
            description: 'Markdown File',
            accept: { 'text/markdown': ['.md'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error(err)
    return
  }
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = requestedFilename
  a.click()
  URL.revokeObjectURL(url)
}

const handleDocDownload = async (
  htmlContent: string,
  requestedFilename: string
) => {
  const header =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Document</title></head><body>"
  const footer = '</body></html>'
  const sourceHTML = header + htmlContent + footer

  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: requestedFilename,
        types: [
          {
            description: 'Word Document',
            accept: { 'application/msword': ['.doc'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(sourceHTML)
      await writable.close()
      return
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error(err)
    return
  }
  const blob = new Blob([sourceHTML], {
    type: 'application/msword;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = requestedFilename
  a.click()
  URL.revokeObjectURL(url)
}

interface MarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  readOnly?: boolean
  onFileDrop?: (file: File) => Promise<void>
  slug?: string | null
}

// Custom components for every markdown element — fully styled for dark/light mode
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 className='text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-8 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700 first:mt-0 leading-tight'>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className='text-2xl font-bold text-zinc-800 dark:text-zinc-200 mt-7 mb-3 pb-1.5 border-b border-zinc-200 dark:border-zinc-700 leading-tight'>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className='text-xl font-semibold text-zinc-800 dark:text-zinc-200 mt-6 mb-2.5 leading-tight'>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className='text-lg font-semibold text-zinc-700 dark:text-zinc-300 mt-5 mb-2 leading-tight'>
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className='text-base font-semibold text-zinc-700 dark:text-zinc-300 mt-4 mb-1.5 leading-tight'>
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className='text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-4 mb-1.5 uppercase tracking-wide leading-tight'>
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className='text-zinc-700 dark:text-zinc-300 leading-7 mb-4 last:mb-0'>
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors'
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className='font-bold text-zinc-900 dark:text-zinc-100'>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className='italic text-zinc-700 dark:text-zinc-300'>{children}</em>
  ),
  del: ({ children }) => (
    <del className='line-through text-zinc-400 dark:text-zinc-500'>
      {children}
    </del>
  ),
  ul: ({ children }) => (
    <ul className='list-disc pl-6 mb-4 space-y-1.5 text-zinc-700 dark:text-zinc-300'>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className='list-decimal pl-6 mb-4 space-y-1.5 text-zinc-700 dark:text-zinc-300'>
      {children}
    </ol>
  ),
  li: ({ children }) => <li className='leading-7'>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className='border-l-4 border-emerald-500 dark:border-emerald-400 pl-4 py-0.5 my-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-r-md text-zinc-600 dark:text-zinc-400 italic'>
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className='px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/50 text-emerald-600 dark:text-emerald-400 font-mono text-[0.875em] border border-zinc-200 dark:border-zinc-700/50'>
          {children}
        </code>
      )
    }
    return (
      <code className='block font-mono text-sm text-zinc-800 dark:text-zinc-200'>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className='bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 my-4 overflow-x-auto text-zinc-800 dark:text-zinc-200 text-sm font-mono leading-relaxed shadow-sm'>
      {children}
    </pre>
  ),
  hr: () => <hr className='my-6 border-zinc-200 dark:border-zinc-700' />,
  table: ({ children }) => (
    <div className='my-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700'>
      <table className='w-full text-sm text-left text-zinc-700 dark:text-zinc-300'>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className='bg-zinc-100 dark:bg-zinc-800 text-xs uppercase text-zinc-500 dark:text-zinc-400'>
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className='divide-y divide-zinc-200 dark:divide-zinc-700'>
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className='bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors'>
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className='px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300'>
      {children}
    </th>
  ),
  td: ({ children }) => <td className='px-4 py-3'>{children}</td>,
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className='max-w-full h-auto rounded-lg my-4 shadow-md border border-zinc-200 dark:border-zinc-700'
    />
  ),
  input: ({ type, checked, disabled }) => (
    <input
      type={type}
      checked={checked}
      disabled={disabled}
      readOnly
      className='mr-2 accent-emerald-500 cursor-default'
    />
  ),
}

export default function MarkdownEditor({
  content,
  onChange,
  readOnly = false,
  onFileDrop,
  slug,
}: MarkdownEditorProps) {
  const [leftWidth, setLeftWidth] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const previewRef = React.useRef<HTMLDivElement>(null)
  const isSyncing = React.useRef(false)

  const debouncedContent = useDebounce(content, 150)

  // Scroll sync: textarea → preview
  const onTextareaScroll = React.useCallback(() => {
    if (isSyncing.current || !textareaRef.current || !previewRef.current) return
    isSyncing.current = true
    const { scrollTop, scrollHeight, clientHeight } = textareaRef.current
    const pct = scrollTop / (scrollHeight - clientHeight)
    const preview = previewRef.current
    preview.scrollTop = pct * (preview.scrollHeight - preview.clientHeight)
    requestAnimationFrame(() => {
      isSyncing.current = false
    })
  }, [])

  // Scroll sync: preview → textarea
  const onPreviewScroll = React.useCallback(() => {
    if (isSyncing.current || !textareaRef.current || !previewRef.current) return
    isSyncing.current = true
    const { scrollTop, scrollHeight, clientHeight } = previewRef.current
    const pct = scrollTop / (scrollHeight - clientHeight)
    const textarea = textareaRef.current
    textarea.scrollTop = pct * (textarea.scrollHeight - textarea.clientHeight)
    requestAnimationFrame(() => {
      isSyncing.current = false
    })
  }, [])

  const startResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const stopResizing = React.useCallback(() => setIsDragging(false), [])

  const resize = React.useCallback(
    (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const pct = ((e.clientX - rect.left) / rect.width) * 100
        if (pct > 20 && pct < 80) setLeftWidth(pct)
      }
    },
    [isDragging]
  )

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file && onFileDrop) {
      await onFileDrop(file)
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
      document.body.style.cursor = 'col-resize'
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
      document.body.style.cursor = 'default'
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
      document.body.style.cursor = 'default'
    }
  }, [isDragging, resize, stopResizing])

  return (
    <div
      ref={containerRef}
      className='flex h-full w-full overflow-hidden bg-white dark:bg-[#050505] flex-col md:flex-row relative'
      style={{ '--editor-left-width': `${leftWidth}%` } as React.CSSProperties}
    >
      {/* Left Pane — Raw Editor */}
      <div
        className={cn(
          'w-full md:w-[var(--editor-left-width)] min-w-[200px] border-r border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col relative transition-colors duration-200',
          isDragOver ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className='absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-[2px] pointer-events-none border-4 border-dashed border-emerald-500/50 rounded-lg animate-in fade-in duration-200'>
            <div className='p-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4'>
              <UploadCloud
                size={48}
                className='text-emerald-600 dark:text-emerald-400'
              />
            </div>
            <p className='text-xl font-bold text-emerald-700 dark:text-emerald-300'>
              Drop Markdown here
            </p>
          </div>
        )}
        <div className='flex items-center px-4 py-1 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-11 shrink-0 gap-2'>
          <span className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>
            Markdown
          </span>
          <div className='flex-1' />
          <button
            onClick={() => {
              if (slug) handleMarkdownDownload(content, 'document.md')
            }}
            disabled={!slug}
            title={
              !slug
                ? 'Save or create document first to download'
                : 'Download Markdown (.md)'
            }
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors',
              !slug
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
            )}
          >
            <Download size={14} />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className='flex-1 w-full p-5 bg-white dark:bg-[#09090b] resize-none focus:outline-none dark:text-zinc-200 font-mono text-sm leading-7 caret-emerald-500 selection:bg-emerald-500/20 overflow-y-auto'
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={onTextareaScroll}
          readOnly={readOnly}
          placeholder={
            '# Hello!\n\nStart writing markdown...\n\n- Use **bold**, *italic*\n- Add `code` blocks\n- Create tables, lists & more'
          }
          spellCheck={false}
        />
      </div>

      {/* Drag Handle */}
      <div
        className='hidden md:flex w-[6px] bg-transparent hover:bg-emerald-500/30 dark:hover:bg-emerald-500/20 cursor-col-resize z-40 items-center justify-center transition-colors shrink-0'
        onMouseDown={startResizing}
      />

      {/* Right Pane — Preview */}
      <div className='flex-1 overflow-hidden bg-white dark:bg-[#0a0a0a] min-w-[200px] flex flex-col'>
        <div className='flex items-center px-4 py-1 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-11 shrink-0 gap-2'>
          <span className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>
            Preview
          </span>
          <div className='flex-1' />
          <button
            onClick={() => {
              if (slug && previewRef.current) {
                handleDocDownload(previewRef.current.innerHTML, 'document.doc')
              }
            }}
            disabled={!slug}
            title={
              !slug
                ? 'Save or create document first to download'
                : 'Download as Word Document (.doc)'
            }
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors',
              !slug
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
            )}
          >
            <Download size={14} />
          </button>
        </div>
        <div
          ref={previewRef}
          className='flex-1 p-8 overflow-y-auto'
          onScroll={onPreviewScroll}
        >
          {debouncedContent.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={mdComponents}
            >
              {debouncedContent}
            </ReactMarkdown>
          ) : (
            <div className='h-full flex items-center justify-center'>
              <p className='text-zinc-400 dark:text-zinc-600 text-sm italic'>
                Preview will appear here as you type...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
