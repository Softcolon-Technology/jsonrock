'use client'

import { LocalDocumentRecord } from '@/lib/local-docs'
import { cn } from '@/lib/utils'
import {
  Braces,
  Clock3,
  File,
  FileCode,
  FileText,
  FolderOpen,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import React from 'react'
import { JsonRockLoader } from '../Loader'

interface LocalHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  documents: LocalDocumentRecord[]
  activeSlug: string | null
  isLoading: boolean
  forceLightMode?: boolean
  onOpenDocument: (document: LocalDocumentRecord) => void
  onDeleteDocument: (slug: string) => void | Promise<void>
  onClearAll: () => void | Promise<void>
}

function formatUpdatedAt(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}

function iconForType(type: LocalDocumentRecord['type']) {
  if (type === 'text') return <File size={14} />
  if (type === 'markdown') return <FileText size={14} />
  if (type === 'html') return <FileCode size={14} />
  return <Braces size={14} />
}

export default function LocalHistoryModal({
  isOpen,
  onClose,
  documents,
  activeSlug,
  isLoading,
  forceLightMode = false,
  onOpenDocument,
  onDeleteDocument,
  onClearAll,
}: LocalHistoryModalProps) {
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (isOpen) {
      setSearch('')
    }
  }, [isOpen])

  const filteredDocuments = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return documents

    return documents.filter((doc) => {
      return (
        doc.slug.toLowerCase().includes(query) ||
        doc.title.toLowerCase().includes(query) ||
        doc.preview.toLowerCase().includes(query)
      )
    })
  }, [documents, search])

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
      <div className='absolute inset-0' onClick={onClose} />

      <div
        className={cn(
          'relative z-10 w-full max-w-3xl rounded-xl border bg-white p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh]',
          !forceLightMode && 'dark:bg-zinc-950 dark:border-zinc-800'
        )}
      >
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h3
              className={cn(
                'text-lg font-semibold text-zinc-900 flex items-center gap-2',
                !forceLightMode && 'dark:text-zinc-100'
              )}
            >
              <FolderOpen size={18} className='text-emerald-600' />
              Local History
            </h3>
            <p
              className={cn(
                'text-sm text-zinc-500 mt-1',
                !forceLightMode && 'dark:text-zinc-400'
              )}
            >
              Files stored in your browser using IndexedDB.
            </p>
          </div>

          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors hover:cursor-pointer',
              !forceLightMode &&
                'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            )}
            aria-label='Close local history'
          >
            <X size={18} />
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search
              size={14}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400'
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by slug, title, or content preview'
              disabled={isLoading}
              className={cn(
                'w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-sm text-zinc-900 outline-none focus:ring-1 focus:ring-emerald-500/40',
                isLoading && 'opacity-60 cursor-not-allowed',
                !forceLightMode &&
                  'dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
              )}
            />
          </div>

          <button
            onClick={() => onClearAll()}
            disabled={isLoading || documents.length === 0}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
              isLoading || documents.length === 0
                ? 'cursor-not-allowed text-zinc-400 border-zinc-200 bg-zinc-100'
                : 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:cursor-pointer',
              !forceLightMode &&
                !isLoading &&
                documents.length > 0 &&
                'dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/30 dark:hover:bg-red-950/50'
            )}
          >
            <Trash2 size={13} />
            Clear all
          </button>
        </div>

        <div
          className={cn(
            'rounded-lg border border-zinc-200 overflow-y-auto min-h-[260px] max-h-[58vh] bg-white',
            !forceLightMode && 'dark:border-zinc-800 dark:bg-zinc-950'
          )}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className='h-full min-h-[260px] flex flex-col items-center justify-center gap-3 text-sm text-zinc-500'>
              <JsonRockLoader className='w-10 h-10' />
              <span>Loading local history…</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className='h-full min-h-[260px] flex flex-col items-center justify-center text-center px-4'>
              <Clock3 size={28} className='text-zinc-400 mb-2' />
              <p className='text-sm font-medium text-zinc-700 dark:text-zinc-200'>
                No locally saved files found
              </p>
              <p className='text-xs text-zinc-500 mt-1 max-w-md'>
                Documents are saved automatically while you work. They remain in
                your browser until deleted.
              </p>
            </div>
          ) : (
            <div className='divide-y divide-zinc-200 dark:divide-zinc-800'>
              {filteredDocuments.map((doc) => {
                const isActive = activeSlug === doc.slug

                return (
                  <div
                    key={doc.slug}
                    role='button'
                    tabIndex={0}
                    onClick={() => onOpenDocument(doc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenDocument(doc)
                      }
                    }}
                    className={cn(
                      'px-4 py-3 flex flex-col gap-2 transition-colors cursor-pointer outline-none',
                      'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500',
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/20'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/70'
                    )}
                    aria-label={`Open ${doc.title || doc.slug}`}
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <div className='min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                              doc.type === 'json'
                                ? 'text-cyan-700 border-cyan-200 bg-cyan-50'
                                : doc.type === 'markdown'
                                  ? 'text-indigo-700 border-indigo-200 bg-indigo-50'
                                  : doc.type === 'html'
                                    ? 'text-violet-700 border-violet-200 bg-violet-50'
                                    : 'text-orange-700 border-orange-200 bg-orange-50',
                              !forceLightMode &&
                                doc.type === 'json' &&
                                'dark:text-cyan-400 dark:border-cyan-900/50 dark:bg-cyan-950/30',
                              !forceLightMode &&
                                doc.type === 'markdown' &&
                                'dark:text-indigo-400 dark:border-indigo-900/50 dark:bg-indigo-950/30',
                              !forceLightMode &&
                                doc.type === 'html' &&
                                'dark:text-violet-400 dark:border-violet-900/50 dark:bg-violet-950/30',
                              !forceLightMode &&
                                doc.type === 'text' &&
                                'dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/30'
                            )}
                          >
                            {iconForType(doc.type)}
                            {doc.type}
                          </span>

                          <span
                            className={cn(
                              'text-[11px] text-zinc-500',
                              !forceLightMode && 'dark:text-zinc-400'
                            )}
                          >
                            {doc.slug}
                          </span>
                        </div>

                        <p
                          className={cn(
                            'text-sm font-semibold text-zinc-900 mt-1 truncate',
                            !forceLightMode && 'dark:text-zinc-100'
                          )}
                        >
                          {doc.title}
                        </p>
                        {doc.preview && (
                          <p
                            className={cn(
                              'text-xs text-zinc-500 mt-0.5 line-clamp-2',
                              !forceLightMode && 'dark:text-zinc-400'
                            )}
                          >
                            {doc.preview}
                          </p>
                        )}
                      </div>

                      <div className='flex items-center gap-2 shrink-0'>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenDocument(doc)
                          }}
                          className='px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors hover:cursor-pointer'
                        >
                          Open
                        </button>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteDocument(doc.slug)
                          }}
                          className='p-1.5 rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-colors dark:hover:bg-red-950/30 hover:cursor-pointer'
                          aria-label='Delete local document'
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'text-[11px] text-zinc-500',
                        !forceLightMode && 'dark:text-zinc-400'
                      )}
                    >
                      Last updated: {formatUpdatedAt(doc.updatedAt)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
