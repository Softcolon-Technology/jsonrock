'use client'

import React, { useState, useEffect } from 'react'
import {
  Copy,
  Globe,
  Lock,
  Check,
  ChevronDown,
  Users,
  FileJson,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AccessType = 'editor' | 'viewer'

interface SharePopoverProps {
  isOpen: boolean
  onClose: () => void
  // Current settings
  defaultAccessLevel: AccessType
  defaultIsPrivate: boolean
  defaultPassword?: string
  isPrivacyLocked?: boolean

  // New Prop: Can Configure
  hasPermissionToConfigure?: boolean
  forceLightMode?: boolean

  // Handler for Save & Copy
  onSaveShareSettings: (settings: {
    accessLevel: AccessType
    isPrivateLink: boolean
    sharePassword?: string
  }) => Promise<void>

  isSavingSettings?: boolean
  shareUrl?: string
}

export function SharePopover({
  isOpen,
  onClose,
  defaultAccessLevel,
  defaultIsPrivate,
  defaultPassword = '',
  isPrivacyLocked = false,
  hasPermissionToConfigure = true,
  forceLightMode = false,
  onSaveShareSettings,
  isSavingSettings = false,
  shareUrl = '',
}: SharePopoverProps) {
  const [accessLevel, setAccessLevel] = useState<AccessType>(defaultAccessLevel)
  const [isPrivateLink, setIsPrivateLink] = useState(defaultIsPrivate)
  const [sharePassword, setSharePassword] = useState(defaultPassword)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setAccessLevel(defaultAccessLevel)
      setIsPrivateLink(defaultIsPrivate)
      setSharePassword(defaultPassword)
      setCopied(false)
    }
  }, [isOpen, defaultAccessLevel, defaultIsPrivate, defaultPassword])

  if (!isOpen) return null

  const handleCopy = () => {
    onSaveShareSettings({ accessLevel, isPrivateLink, sharePassword })
  }

  return (
    <div className='fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
      {/* Overlay click to close */}
      <div className='absolute inset-0' onClick={onClose} />

      <div
        className={cn(
          'bg-white border border-zinc-200 text-zinc-800 rounded-xl shadow-2xl w-[90vw] max-w-md p-6 relative animate-in zoom-in-95 duration-200 z-10 flex flex-col gap-6',
          !forceLightMode &&
            'dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100'
        )}
      >
        {/* Header */}
        <div>
          <h3
            className={cn(
              'text-lg font-semibold flex items-center gap-2 text-zinc-900',
              !forceLightMode && 'dark:text-zinc-100'
            )}
          >
            <Users
              size={20}
              className={cn(
                'text-emerald-600',
                !forceLightMode && 'dark:text-emerald-500'
              )}
            />
            Share Visualization
          </h3>
          <p
            className={cn(
              'text-sm text-zinc-500 mt-1',
              !forceLightMode && 'dark:text-zinc-400'
            )}
          >
            Configure access settings and copy the link to share.
          </p>
        </div>

        {!hasPermissionToConfigure && (
          <div
            className={cn(
              'text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1.5 rounded-md flex items-center gap-2 mb-2',
              !forceLightMode &&
                'dark:text-amber-500 dark:bg-amber-500/10 dark:border-amber-500/20'
            )}
          >
            <Lock size={12} />
            Only the owner can modify share settings.
          </div>
        )}

        {/* Access Controls */}
        <div
          className={cn(
            'flex flex-col gap-4 relative',
            !hasPermissionToConfigure &&
              'opacity-50 pointer-events-none select-none'
          )}
        >
          {/* Row 1: Access Type & Privacy */}
          <div className='flex items-start gap-4'>
            {/* Access Type Dropdown */}
            <div className='flex-1 flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-zinc-500 uppercase tracking-wider'>
                Access
              </label>
              <div className='relative group'>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as AccessType)}
                  className={cn(
                    'w-full appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:ring-1 focus:ring-emerald-500/50 outline-none cursor-pointer hover:border-zinc-300 transition-colors',
                    !forceLightMode &&
                      'dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700'
                  )}
                >
                  <option value='viewer'>Viewer (Read Only)</option>
                  <option value='editor'>Editor (Collaborate)</option>
                </select>
                <ChevronDown
                  size={14}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none'
                />
              </div>
            </div>

            {/* Privacy Toggle */}
            <div className='flex-1 flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-zinc-500 uppercase tracking-wider'>
                Visibility
              </label>
              <div
                className={cn(
                  'flex bg-zinc-50 border border-zinc-200 rounded-lg p-1',
                  !forceLightMode && 'dark:bg-zinc-950 dark:border-zinc-800'
                )}
              >
                <button
                  onClick={() => setIsPrivateLink(false)}
                  disabled={!hasPermissionToConfigure || isPrivacyLocked}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all',
                    !isPrivateLink
                      ? cn(
                          'bg-white text-zinc-900 shadow-sm border border-zinc-200',
                          !forceLightMode &&
                            'dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700'
                        )
                      : cn(
                          'text-zinc-500 hover:text-zinc-700',
                          !forceLightMode && 'dark:hover:text-zinc-300'
                        ),
                    (!hasPermissionToConfigure || isPrivacyLocked) &&
                      'cursor-not-allowed opacity-50'
                  )}
                  title={
                    isPrivacyLocked
                      ? 'Cannot change private link back to public'
                      : undefined
                  }
                >
                  <Globe size={12} /> Public
                </button>
                <button
                  onClick={() => setIsPrivateLink(true)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all',
                    isPrivateLink
                      ? cn(
                          'bg-white text-amber-600 shadow-sm border border-zinc-200',
                          !forceLightMode &&
                            'dark:bg-zinc-800 dark:text-amber-500 dark:border-zinc-700'
                        )
                      : cn(
                          'text-zinc-500 hover:text-zinc-700',
                          !forceLightMode && 'dark:hover:text-zinc-300'
                        )
                  )}
                >
                  <Lock size={12} /> Private
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Password (Conditional) */}
          {isPrivateLink && (
            <div className='flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200'>
              <label
                className={cn(
                  'text-xs font-medium text-amber-600 uppercase tracking-wider flex items-center gap-1',
                  !forceLightMode && 'dark:text-amber-500'
                )}
              >
                <Lock size={10} /> Password Required
              </label>
              <div className='relative'>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Set a password (min 4 chars)'
                  value={sharePassword || ''}
                  onChange={(e) => setSharePassword(e.target.value)}
                  className={cn(
                    'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all font-mono pr-10',
                    !forceLightMode &&
                      'dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600'
                  )}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors',
                    !forceLightMode &&
                      'dark:text-zinc-500 dark:hover:text-zinc-300'
                  )}
                  type='button'
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className='text-[10px] text-zinc-500'>
                Anyone with the link will need to enter this password to decrypt
                the document.
              </p>
            </div>
          )}

          {/* Share Link Preview (if link exists) */}
          {shareUrl && (
            <div className='flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-zinc-500 uppercase tracking-wider'>
                Share Link
              </label>
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  readOnly
                  value={shareUrl}
                  className={cn(
                    'flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 select-all font-mono truncate outline-none',
                    !forceLightMode &&
                      'dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300'
                  )}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type='button'
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2500)
                    } catch (e) {
                      console.warn('Direct copy failed', e)
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer',
                    copied
                      ? 'bg-emerald-600 text-white'
                      : cn(
                          'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200',
                          !forceLightMode &&
                            'dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 dark:text-zinc-200'
                        )
                  )}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* E2EE Info Callout */}
          <div
            className={cn(
              'p-2.5 rounded-lg border text-xs flex items-start gap-2',
              !forceLightMode
                ? 'bg-emerald-50/50 border-emerald-200/60 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300'
                : 'bg-emerald-50/50 border-emerald-200/60 text-emerald-800'
            )}
          >
            <Lock
              size={14}
              className='shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400'
            />
            <div className='flex flex-col gap-0.5'>
              <span className='font-semibold'>
                End-to-End Encrypted (Zero Knowledge)
              </span>
              <span className='text-[11px] opacity-90 leading-tight'>
                The server never sees your content or keys. If a private
                password or public link key is lost, content cannot be
                recovered.
              </span>
            </div>
          </div>
        </div>

        {!hasPermissionToConfigure && (
          <div
            className='absolute inset-0 bg-transparent z-20 cursor-not-allowed'
            title='Only the owner can modify share settings'
          />
        )}

        {/* Footer Actions */}
        <div className='flex items-center gap-3 pt-2 relative z-30'>
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors',
              !forceLightMode &&
                'dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={
              isSavingSettings ||
              (isPrivateLink && (!sharePassword || sharePassword.length < 4))
            }
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-all',
              isSavingSettings ||
                (isPrivateLink && (!sharePassword || sharePassword.length < 4))
                ? cn(
                    'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200',
                    !forceLightMode &&
                      'dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700'
                  )
                : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-900/30 active:scale-[0.98]'
            )}
          >
            {isSavingSettings ? (
              <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
            ) : (
              <Copy size={16} />
            )}
            {isSavingSettings ? 'Saving...' : 'Save & Copy Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
