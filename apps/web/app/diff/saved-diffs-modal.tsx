'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  X,
  Trash2,
  FileText,
  Clock,
  Pencil,
  Check,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getAllDiffs,
  deleteDiff,
  updateDiff,
  type DiffRecord,
} from '@/lib/diff-db'

interface SavedDiffsModalProps {
  isOpen: boolean
  onClose: () => void
  onLoad: (diff: DiffRecord) => void
}

export default function SavedDiffsModal({
  isOpen,
  onClose,
  onLoad,
}: SavedDiffsModalProps) {
  const [diffs, setDiffs] = useState<DiffRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadDiffs = useCallback(async () => {
    setIsLoading(true)
    try {
      const all = await getAllDiffs()
      setDiffs(all)
    } catch (e) {
      console.error('Failed to load diffs:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadDiffs()
    }
  }, [isOpen, loadDiffs])

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteDiff(id)
      setDiffs((prev) => prev.filter((d) => d.id !== id))
    } catch (e) {
      console.error('Failed to delete diff:', e)
    } finally {
      setDeletingId(null)
    }
  }

  const handleRenameStart = (diff: DiffRecord) => {
    setEditingId(diff.id!)
    setEditName(diff.name)
  }

  const handleRenameSave = async () => {
    if (editingId === null || !editName.trim()) return
    try {
      await updateDiff(editingId, { name: editName.trim() })
      setDiffs((prev) =>
        prev.map((d) =>
          d.id === editingId ? { ...d, name: editName.trim() } : d
        )
      )
    } catch (e) {
      console.error('Failed to rename diff:', e)
    } finally {
      setEditingId(null)
      setEditName('')
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const getPreview = (text: string, maxLen = 60) => {
    const trimmed = text.trim().replace(/\s+/g, ' ')
    return trimmed.length > maxLen
      ? trimmed.substring(0, maxLen) + '…'
      : trimmed
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity duration-200'
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101]',
          'w-[95vw] max-w-lg max-h-[80vh] flex flex-col',
          'bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl',
          'border border-zinc-200 dark:border-zinc-800',
          'animate-in zoom-in-95 fade-in duration-200'
        )}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30'>
              <FolderOpen
                size={18}
                className='text-emerald-600 dark:text-emerald-400'
              />
            </div>
            <div>
              <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>
                Saved Comparisons
              </h2>
              <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                {diffs.length} saved diff{diffs.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all'
            aria-label='Close modal'
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto px-4 py-3 min-h-0'>
          {isLoading ? (
            <div className='flex items-center justify-center py-16'>
              <div className='w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin' />
            </div>
          ) : diffs.length === 0 ? (
            /* Empty state */
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <div className='p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4'>
                <FileText
                  size={32}
                  className='text-zinc-400 dark:text-zinc-500'
                />
              </div>
              <p className='text-sm font-medium text-zinc-600 dark:text-zinc-300'>
                No saved comparisons yet
              </p>
              <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-[240px]'>
                Compare two JSONs and click "Save" to store them locally for
                later.
              </p>
            </div>
          ) : (
            <div className='space-y-2'>
              {diffs.map((diff) => (
                <div
                  key={diff.id}
                  className={cn(
                    'group relative rounded-xl border border-zinc-200 dark:border-zinc-800',
                    'bg-zinc-50 dark:bg-zinc-800/50',
                    'hover:border-emerald-300 dark:hover:border-emerald-700',
                    'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
                    'transition-all duration-150 cursor-pointer'
                  )}
                  onClick={() => {
                    if (editingId !== diff.id) {
                      onLoad(diff)
                      onClose()
                    }
                  }}
                >
                  <div className='px-4 py-3'>
                    {/* Name row */}
                    <div className='flex items-center justify-between mb-1.5'>
                      {editingId === diff.id ? (
                        <div
                          className='flex items-center gap-1.5 flex-1 mr-2'
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type='text'
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSave()
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className='flex-1 px-2 py-0.5 text-sm font-medium rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500'
                            autoFocus
                          />
                          <button
                            onClick={handleRenameSave}
                            className='p-1 rounded-md text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors'
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className='text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate'>
                          {diff.name}
                        </span>
                      )}

                      {/* Actions */}
                      <div
                        className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0'
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleRenameStart(diff)}
                          className='p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors'
                          title='Rename'
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(diff.id!)}
                          disabled={deletingId === diff.id}
                          className='p-1 rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50'
                          title='Delete'
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Preview */}
                    <p className='text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate'>
                      {getPreview(diff.original)} ↔ {getPreview(diff.modified)}
                    </p>

                    {/* Timestamp */}
                    <div className='flex items-center gap-1.5 mt-2'>
                      <Clock
                        size={11}
                        className='text-zinc-400 dark:text-zinc-500'
                      />
                      <span className='text-[11px] text-zinc-400 dark:text-zinc-500'>
                        {formatDate(diff.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0'>
          <p className='text-[11px] text-zinc-400 dark:text-zinc-500 text-center'>
            All comparisons are stored locally in your browser
          </p>
        </div>
      </div>
    </>
  )
}
