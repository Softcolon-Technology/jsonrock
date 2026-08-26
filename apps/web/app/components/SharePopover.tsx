'use client'

import React, { useState, useEffect } from 'react'
import {
  Copy,
  Globe,
  Lock,
  Check,
  ChevronDown,
  Users,
  Eye,
  EyeOff,
  Mail,
  Link2,
  Send,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ShareType } from '@/app/iterface'

export type AccessType = 'editor' | 'viewer'

export type ShareDeliveryMethod = 'link' | 'email'

export interface ShareSettingsPayload {
  accessLevel: AccessType
  isPrivateLink: boolean
  sharePassword?: string
  previewOnly?: boolean
}

interface SharePopoverProps {
  isOpen: boolean
  onClose: () => void
  // Current settings
  defaultAccessLevel: AccessType
  defaultIsPrivate: boolean
  defaultPassword?: string
  defaultPreviewOnly?: boolean
  isPrivacyLocked?: boolean
  documentType?: ShareType
  documentTitle?: string

  // New Prop: Can Configure
  hasPermissionToConfigure?: boolean
  forceLightMode?: boolean

  /**
   * Save share settings (same path as copy-link). Resolves to the absolute share URL.
   */
  onSaveShareSettings: (
    settings: ShareSettingsPayload,
    options?: { copyToClipboard?: boolean }
  ) => Promise<string>

  /**
   * Send share link email after settings are saved. Parent supplies auth headers.
   */
  onSendShareEmail: (payload: {
    recipientEmail: string
    shareUrl: string
    documentTitle: string
  }) => Promise<{ message?: string }>

  isSavingSettings?: boolean
  shareUrl?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SharePopover({
  isOpen,
  onClose,
  defaultAccessLevel,
  defaultIsPrivate,
  defaultPassword = '',
  defaultPreviewOnly = false,
  isPrivacyLocked = false,
  documentType = 'json',
  documentTitle = 'Untitled document',
  hasPermissionToConfigure = true,
  forceLightMode = false,
  onSaveShareSettings,
  onSendShareEmail,
  isSavingSettings = false,
  shareUrl = '',
}: SharePopoverProps) {
  const [accessLevel, setAccessLevel] = useState<AccessType>(defaultAccessLevel)
  const [isPrivateLink, setIsPrivateLink] = useState(defaultIsPrivate)
  const [sharePassword, setSharePassword] = useState(defaultPassword)
  const [previewOnly, setPreviewOnly] = useState(defaultPreviewOnly)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deliveryMethod, setDeliveryMethod] =
    useState<ShareDeliveryMethod>('link')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setAccessLevel(defaultAccessLevel)
      setIsPrivateLink(defaultIsPrivate)
      setSharePassword(defaultPassword)
      setPreviewOnly(defaultPreviewOnly)
      setCopied(false)
      setDeliveryMethod('link')
      setRecipientEmail('')
      setEmailError(null)
      setEmailStatus(null)
      setIsSendingEmail(false)
    }
  }, [
    isOpen,
    defaultAccessLevel,
    defaultIsPrivate,
    defaultPassword,
    defaultPreviewOnly,
  ])

  if (!isOpen) return null

  const settingsInvalid =
    isPrivateLink && (!sharePassword || sharePassword.length < 4)

  const currentSettings = (): ShareSettingsPayload => ({
    accessLevel,
    isPrivateLink,
    sharePassword,
    previewOnly: documentType === 'markdown' ? previewOnly : false,
  })

  const handleCopy = async () => {
    setEmailStatus(null)
    try {
      await onSaveShareSettings(currentSettings(), { copyToClipboard: true })
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Parent surfaces share failures via toast/alert
    }
  }

  const handleSendEmail = async () => {
    setEmailStatus(null)
    const trimmed = recipientEmail.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address.')
      return
    }
    setEmailError(null)
    setIsSendingEmail(true)
    try {
      const url = await onSaveShareSettings(currentSettings(), {
        copyToClipboard: false,
      })
      const result = await onSendShareEmail({
        recipientEmail: trimmed,
        shareUrl: url,
        documentTitle: documentTitle || 'Untitled document',
      })
      setEmailStatus({
        type: 'success',
        message: result.message || `Share link sent to ${trimmed}.`,
      })
    } catch (e) {
      setEmailStatus({
        type: 'error',
        message:
          e instanceof Error ? e.message : 'Failed to send email. Try again.',
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <div className='fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
      {/* Overlay click to close */}
      <div className='absolute inset-0' onClick={onClose} />

      <div
        className={cn(
          'bg-white border border-zinc-200 text-zinc-800 rounded-xl shadow-2xl w-[90vw] max-w-md p-6 relative animate-in zoom-in-95 duration-200 z-10 flex flex-col gap-5 max-h-[90vh] overflow-y-auto',
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
            Configure access settings, then copy the link or email it.
          </p>
        </div>

        {!hasPermissionToConfigure && (
          <div
            className={cn(
              'text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1.5 rounded-md flex items-center gap-2',
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
            <div className='flex-1 flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-zinc-500 uppercase tracking-wider'>
                Access
              </label>
              <div className='relative group'>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as AccessType)}
                  disabled={documentType === 'markdown' && previewOnly}
                  className={cn(
                    'w-full appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:ring-1 focus:ring-emerald-500/50 outline-none cursor-pointer hover:border-zinc-300 transition-colors',
                    !forceLightMode &&
                      'dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700',
                    documentType === 'markdown' &&
                      previewOnly &&
                      'opacity-60 cursor-not-allowed'
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

          {/* Markdown: share as preview only */}
          {documentType === 'markdown' && (
            <label
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                previewOnly
                  ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                  : cn(
                      'border-zinc-200 bg-zinc-50 hover:border-zinc-300',
                      !forceLightMode &&
                        'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700'
                    )
              )}
            >
              <input
                type='checkbox'
                checked={previewOnly}
                onChange={(e) => {
                  const next = e.target.checked
                  setPreviewOnly(next)
                  if (next) setAccessLevel('viewer')
                }}
                className='mt-0.5 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500'
              />
              <span className='flex flex-col gap-0.5 min-w-0'>
                <span className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                  Share as preview only
                </span>
                <span className='text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug'>
                  Recipients see a clean, read-only rendered article — no source
                  editor or editing, regardless of access level.
                </span>
              </span>
            </label>
          )}

          {/* Delivery method */}
          <div className='flex flex-col gap-1.5'>
            <label className='text-xs font-medium text-zinc-500 uppercase tracking-wider'>
              Share via
            </label>
            <div
              className={cn(
                'flex bg-zinc-50 border border-zinc-200 rounded-lg p-1',
                !forceLightMode && 'dark:bg-zinc-950 dark:border-zinc-800'
              )}
            >
              <button
                type='button'
                onClick={() => {
                  setDeliveryMethod('link')
                  setEmailStatus(null)
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all',
                  deliveryMethod === 'link'
                    ? cn(
                        'bg-white text-zinc-900 shadow-sm border border-zinc-200',
                        !forceLightMode &&
                          'dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700'
                      )
                    : cn(
                        'text-zinc-500 hover:text-zinc-700',
                        !forceLightMode && 'dark:hover:text-zinc-300'
                      )
                )}
              >
                <Link2 size={12} /> Copy link
              </button>
              <button
                type='button'
                onClick={() => {
                  setDeliveryMethod('email')
                  setCopied(false)
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all',
                  deliveryMethod === 'email'
                    ? cn(
                        'bg-white text-zinc-900 shadow-sm border border-zinc-200',
                        !forceLightMode &&
                          'dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700'
                      )
                    : cn(
                        'text-zinc-500 hover:text-zinc-700',
                        !forceLightMode && 'dark:hover:text-zinc-300'
                      )
                )}
              >
                <Mail size={12} /> Email
              </button>
            </div>
          </div>

          {deliveryMethod === 'email' && (
            <div className='flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200'>
              <label className='text-xs font-medium text-zinc-500 uppercase tracking-wider'>
                Recipient email
              </label>
              <input
                type='email'
                value={recipientEmail}
                onChange={(e) => {
                  setRecipientEmail(e.target.value)
                  setEmailError(null)
                  setEmailStatus(null)
                }}
                placeholder='name@example.com'
                className={cn(
                  'w-full bg-zinc-50 border rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all',
                  emailError
                    ? 'border-red-400 focus:ring-red-500/30 focus:border-red-400'
                    : cn(
                        'border-zinc-200 focus:border-emerald-500/50 focus:ring-emerald-500/20',
                        !forceLightMode &&
                          'dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600'
                      )
                )}
              />
              {emailError && (
                <p className='text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1'>
                  <AlertCircle size={11} /> {emailError}
                </p>
              )}
              <p className='text-[10px] text-zinc-500'>
                Only the share link and title are emailed — never the document
                content. Recipients still use the normal open/unlock flow.
              </p>
            </div>
          )}

          {/* Share Link Preview (if link exists) */}
          {shareUrl && deliveryMethod === 'link' && (
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

          {emailStatus && (
            <div
              className={cn(
                'text-xs rounded-lg border px-3 py-2 flex items-start gap-2',
                emailStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
              )}
            >
              {emailStatus.type === 'success' ? (
                <Check size={14} className='shrink-0 mt-0.5' />
              ) : (
                <AlertCircle size={14} className='shrink-0 mt-0.5' />
              )}
              <span>{emailStatus.message}</span>
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
        <div className='flex items-center gap-3 pt-1 relative z-30'>
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
          {deliveryMethod === 'link' ? (
            <button
              onClick={handleCopy}
              disabled={isSavingSettings || settingsInvalid}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-all',
                isSavingSettings || settingsInvalid
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
          ) : (
            <button
              onClick={handleSendEmail}
              disabled={
                isSavingSettings ||
                isSendingEmail ||
                settingsInvalid ||
                !recipientEmail.trim()
              }
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-all',
                isSavingSettings ||
                  isSendingEmail ||
                  settingsInvalid ||
                  !recipientEmail.trim()
                  ? cn(
                      'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200',
                      !forceLightMode &&
                        'dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700'
                    )
                  : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-900/30 active:scale-[0.98]'
              )}
            >
              {isSavingSettings || isSendingEmail ? (
                <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
              ) : (
                <Send size={16} />
              )}
              {isSavingSettings
                ? 'Saving...'
                : isSendingEmail
                  ? 'Sending...'
                  : 'Save & Send Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
