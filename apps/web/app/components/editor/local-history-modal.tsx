'use client'

import {
  DOCUMENT_TITLE_MAX_LENGTH,
  LocalDocumentRecord,
} from '@/lib/local-docs'
import { cn } from '@/lib/utils'
import {
  Braces,
  Clock3,
  File,
  FileCode,
  FileText,
  FolderOpen,
  Pencil,
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
  onRenameDocument: (
    slug: string,
    title: string
  ) => Promise<LocalDocumentRecord | null>
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
  onRenameDocument,
}: LocalHistoryModalProps) {
  const [search, setSearch] = React.useState('')
  const [editingSlug, setEditingSlug] = React.useState<string | null>(null)
  const [draftTitle, setDraftTitle] = React.useState('')
  const [isSavingTitle, setIsSavingTitle] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const skipCommitRef = React.useRef(false)

  React.useEffect(() => {
    if (isOpen) {
      setSearch('')
      setEditingSlug(null)
      setDraftTitle('')
      setIsSavingTitle(false)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (editingSlug && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSlug])

  const filteredDocuments = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return documents

    return documents.filter((doc) => {
      return (
        doc.slug.toLowerCase().includes(query) ||
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.preview || '').toLowerCase().includes(query)
      )
    })
  }, [documents, search])

  const startEditing = (doc: LocalDocumentRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSlug(doc.slug)
    setDraftTitle(doc.title || '')
  }

  const cancelEditing = () => {
    skipCommitRef.current = true
    setEditingSlug(null)
    setDraftTitle('')
    setIsSavingTitle(false)
  }

  const commitEditing = async (slug: string) => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      return
    }
    if (isSavingTitle) return
    setIsSavingTitle(true)
    try {
      await onRenameDocument(slug, draftTitle)
    } catch (error) {
      console.error('Failed to rename local document', error)
    } finally {
      setIsSavingTitle(false)
      setEditingSlug(null)
      setDraftTitle('')
    }
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
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
            'rounded-lg border border-zinc-200 overflow-y-auto min-h-65 max-h-[58vh] bg-white',
            !forceLightMode && 'dark:border-zinc-800 dark:bg-zinc-950'
          )}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className='h-full min-h-65 flex flex-col items-center justify-center gap-3 text-sm text-zinc-500'>
              <JsonRockLoader className='w-10 h-10' />
              <span>Loading local history…</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className='h-full min-h-65 flex flex-col items-center justify-center text-center px-4'>
              <Clock3 size={28} className='text-zinc-400 mb-2' />
              <p
                className={cn(
                  'text-sm font-medium text-zinc-700',
                  !forceLightMode && 'dark:text-zinc-200'
                )}
              >
                No locally saved files found
              </p>
              <p className='text-xs text-zinc-500 mt-1 max-w-md'>
                Documents are saved automatically while you work. They remain in
                your browser until deleted.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'divide-y divide-zinc-200',
                !forceLightMode && 'dark:divide-zinc-800'
              )}
            >
              {filteredDocuments.map((doc) => {
                const isActive = activeSlug === doc.slug
                const isEditing = editingSlug === doc.slug

                return (
                  <div
                    key={doc.slug}
                    role='button'
                    tabIndex={0}
                    onClick={() => {
                      if (isEditing) return
                      onOpenDocument(doc)
                    }}
                    onKeyDown={(e) => {
                      if (isEditing) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenDocument(doc)
                      }
                    }}
                    className={cn(
                      'px-4 py-3 flex flex-col gap-2 transition-colors outline-none',
                      'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500',
                      isEditing ? 'cursor-default' : 'cursor-pointer',
                      isActive
                        ? cn(
                            'bg-emerald-50',
                            !forceLightMode && 'dark:bg-emerald-950/20'
                          )
                        : cn(
                            'hover:bg-zinc-50',
                            !forceLightMode && 'dark:hover:bg-zinc-900/70'
                          )
                    )}
                    aria-label={`Open ${doc.title || doc.slug}`}
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <div className='min-w-0 flex-1'>
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

                        {isEditing ? (
                          <div
                            className='mt-1.5 flex items-center gap-2'
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              ref={inputRef}
                              type='text'
                              value={draftTitle}
                              maxLength={DOCUMENT_TITLE_MAX_LENGTH}
                              disabled={isSavingTitle}
                              onChange={(e) => setDraftTitle(e.target.value)}
                              onBlur={() => {
                                void commitEditing(doc.slug)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  e.currentTarget.blur()
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelEditing()
                                }
                              }}
                              className={cn(
                                'flex-1 min-w-0 rounded-md border border-emerald-400 bg-white px-2 py-1 text-sm font-semibold text-zinc-900 outline-none focus:ring-1 focus:ring-emerald-500/50',
                                !forceLightMode &&
                                  'dark:bg-zinc-900 dark:text-zinc-100 dark:border-emerald-700'
                              )}
                              aria-label='Edit document title'
                            />
                            <span
                              className={cn(
                                'shrink-0 text-[11px] tabular-nums text-zinc-500',
                                !forceLightMode && 'dark:text-zinc-400'
                              )}
                            >
                              {draftTitle.length}/{DOCUMENT_TITLE_MAX_LENGTH}
                            </span>
                          </div>
                        ) : (
                          <div className='mt-1 flex items-center gap-1.5 min-w-0'>
                            <p
                              className={cn(
                                'min-w-0 max-w-48 sm:max-w-[18rem] md:max-w-[24rem]',
                                'overflow-hidden text-ellipsis whitespace-nowrap',
                                'text-sm font-semibold text-zinc-900',
                                !forceLightMode && 'dark:text-zinc-100'
                              )}
                              title={doc.title}
                            >
                              {doc.title}
                            </p>
                            <button
                              type='button'
                              onClick={(e) => startEditing(doc, e)}
                              className={cn(
                                'shrink-0 p-1 rounded-md text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors hover:cursor-pointer',
                                !forceLightMode &&
                                  'dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400'
                              )}
                              title='Rename document'
                              aria-label={`Rename ${doc.title || doc.slug}`}
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}
                        {doc.preview && !isEditing && (
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
                          className={cn(
                            'p-1.5 rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-colors hover:cursor-pointer',
                            !forceLightMode && 'dark:hover:bg-red-950/30'
                          )}
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
