'use client'

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import type { Edge, Node } from 'reactflow'
import {
  Code2,
  GitGraph,
  LayoutTemplate,
  Copy,
  Check,
  Lock,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  UploadCloud,
  X,
  Loader2,
  Eye,
  EyeOff,
  PanelLeftOpen,
} from 'lucide-react'

import { getJsonParseError } from '@/lib/json-error'

import { getSocket } from '@/lib/socket'

import { ModalAlert } from '../components/ui/ModalAlert'
import { Toast } from '../components/ui/Toast'
import { SharePopover } from '../components/SharePopover'
import LocalHistoryModal from '../components/editor/local-history-modal'
import Cookies from 'js-cookie'
import { JsonRockLoader } from '../components/Loader'

const JsonEditor = dynamic(() => import('../components/JsonEditor'), {
  ssr: false,
})
const GraphView = dynamic(() => import('../components/GraphView'), {
  ssr: false,
})
const TreeExplorer = dynamic(() => import('../components/TreeExplorer'), {
  ssr: false,
})

/** Stable Monaco options — recreating this object every render can dispose Monaco mid-update. */
const JSON_EDITOR_INPUT_OPTIONS = {
  padding: { top: 16, bottom: 100 },
} as const
import { getLayoutedElements, applyElkLayout } from '@/lib/graph-layout'
import { useJsonWorker, TreeNodeSlim } from '@/hooks/useJsonWorker'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import dynamic from 'next/dynamic'
import EditorHeader from '../components/editor/editor-header'
import { ShareType, getEditorBasePath } from '../iterface'
import {
  clearLocalDocuments,
  deleteLocalDocumentBySlug,
  deriveDocumentTitle,
  getLocalDocumentBySlug,
  listLocalDocuments,
  LocalDocumentRecord,
  saveLocalDocument,
  updateLocalDocumentTitle,
} from '@/lib/local-docs'
import {
  EditorTabSnapshot,
  getEditorTabSession,
  patchEditorTabSession,
  setEditorTabSession,
} from '@/lib/editor-tab-session'
import {
  decryptContent,
  deriveKeyFromPassword,
  encryptContent,
  extractKeyFromFragment,
  generateDocumentKey,
  generateSalt,
  importKeyFromFragment,
  setKeyInFragment,
} from '@/lib/crypto'
import {
  buildOwnerKeyWrapped,
  tryOwnerUnwrapContentKey,
} from '@/lib/owner-key-wrap'
import { useUser, useAuth, useClerk } from '@clerk/nextjs'

const RichTextEditor = dynamic(() => import('../components/RichTextEditor'), {
  ssr: false,
})

const MarkdownEditor = dynamic(() => import('../components/MarkdownEditor'), {
  ssr: false,
})

const HtmlEditor = dynamic(() => import('../components/HtmlEditor'), {
  ssr: false,
})

const DEFAULT_HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HTML Preview</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 2rem;
      line-height: 1.5;
      color: #18181b;
      background: #fff;
    }
    h1 { margin-top: 0; }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
    button {
      padding: 0.5rem 0.75rem;
      border: 1px solid #d4d4d8;
      border-radius: 0.375rem;
      background: #f4f4f5;
      cursor: pointer;
    }
    button:hover { background: #e4e4e7; }
  </style>
</head>
<body>
  <h1>Hello HTML</h1>
  <p>Turn <strong>Safe Mode</strong> off to run scripts, then try these:</p>
  <div class="row">
    <button onclick="console.log('hello from log')">console.log</button>
    <button onclick="console.warn('hello from warn')">console.warn</button>
    <button onclick="console.error('hello from error')">console.error</button>
    <button onclick="notDefined()">throw ReferenceError</button>
  </div>
</body>
</html>`

const DEFAULT_JSON_CONTENT = `{
  "project": "JSON ROCK",
  "visualize": true,
  "features": [
    "Graph View",
    "Tree View",
    "Formatter"
  ],
  "metrics": {
    "speed": 100,
    "usability": "high"
  }
}`

const DEFAULT_MARKDOWN_CONTENT = '# Hello Markdown\n\nStart typing...'

function getDefaultEditorContent(type: ShareType): string {
  if (type === 'text') return ''
  if (type === 'markdown') return DEFAULT_MARKDOWN_CONTENT
  if (type === 'html') return DEFAULT_HTML_CONTENT
  return DEFAULT_JSON_CONTENT
}

export type JsonShareMode = 'visualize' | 'tree' | 'formatter'

export type ShareAccessType = 'editor' | 'viewer'

export interface ShareLinkRecord {
  _id?: string
  slug: string
  type: ShareType
  schemaVersion?: number
  isLegacyPlaintext?: boolean
  ciphertext: string
  iv: string
  salt?: string
  json?: string // Content (json or text, populated after client decrypt or legacy load)
  mode: JsonShareMode
  isPrivate: boolean
  accessType?: ShareAccessType // Defaults to 'viewer' if undefined for old records
  previewOnly?: boolean
  /** Clerk user id of the document owner (public metadata; never includes wrap secret). */
  ownerId?: string | null
  /** True when a wrapped owner content key exists (payload itself is not public). */
  hasOwnerKeyWrapped?: boolean
  createdAt: Date
  updatedAt: Date
}

type SerializedShareLinkRecord = Omit<ShareLinkRecord, 'createdAt' | '_id'> & {
  createdAt: string
  _id?: string
  accessType?: ShareAccessType
  type?: ShareType
  schemaVersion?: number
  isLegacyPlaintext?: boolean
  json?: string
  previewOnly?: boolean
  ownerId?: string | null
  hasOwnerKeyWrapped?: boolean
}

interface HomeProps {
  initialRecord?: SerializedShareLinkRecord
  featureMode?: ShareType
}

export default function Home({
  initialRecord,
  featureMode = 'json',
}: HomeProps) {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const urlSlug = params?.slug as string | undefined

  const paramView = searchParams?.get('view') as JsonShareMode | undefined
  const paramType = searchParams?.get('type') as ShareType | undefined

  // Determine effective initial values
  // paramView (URL param) takes priority over DB stored mode — URL represents explicit user intent
  const effectiveFeatureMode = initialRecord?.type || paramType || featureMode
  const effectiveViewMode = paramView || initialRecord?.mode || 'visualize'

  // Session cache for this editor type. Header tab switches remount EditorPage
  // (different routes), so we hydrate from the in-memory store instead of defaults.
  const cachedRootSession =
    !urlSlug && !initialRecord
      ? getEditorTabSession(effectiveFeatureMode)
      : undefined

  const [isLegacyDocument, setIsLegacyDocument] = useState<boolean>(
    cachedRootSession?.isLegacyDocument ??
      (initialRecord?.isLegacyPlaintext ||
        initialRecord?.schemaVersion === 1 ||
        false)
  )
  const [showMigrationBanner, setShowMigrationBanner] = useState<boolean>(
    cachedRootSession?.showMigrationBanner ??
      (initialRecord?.isLegacyPlaintext ||
        initialRecord?.schemaVersion === 1 ||
        false)
  )

  const [currentJsonContent, setCurrentJsonContent] = useState<string>(() => {
    if (initialRecord?.isLegacyPlaintext && initialRecord.json) {
      return initialRecord.json
    }
    if (cachedRootSession) return cachedRootSession.content
    return getDefaultEditorContent(effectiveFeatureMode)
  })

  const lastPersistedContentRef = React.useRef<string>(
    cachedRootSession?.lastPersistedContent ?? currentJsonContent
  )

  // Clerk Authentication state
  const { isSignedIn, isLoaded: isUserLoaded } = useUser()
  const { getToken, isLoaded: isAuthLoaded, userId: clerkUserId } = useAuth()
  const { openSignIn } = useClerk()

  // [AUTH-DEBUG] TEMP — every render (do not remove until live diagnosis complete)
  console.log(Date.now(), 'auth state: editor-page', {
    isLoaded: isUserLoaded,
    isAuthLoaded,
    isSignedIn,
    userId: clerkUserId ?? null,
  })

  // [AUTH-DEBUG] TEMP — wrap fetch once to log Clerk network timing/status
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as Window & { __authDebugFetchPatched?: boolean }
    if (w.__authDebugFetchPatched) return
    w.__authDebugFetchPatched = true

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const input = args[0]
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      const isClerk = /clerk\.(com|accounts\.dev)|clerk\.|\/v1\//i.test(url)
      const started = Date.now()
      try {
        const res = await originalFetch(...args)
        if (isClerk) {
          console.log(Date.now(), '[AUTH-DEBUG] clerk fetch', {
            url,
            status: res.status,
            ok: res.ok,
            ms: Date.now() - started,
          })
        }
        return res
      } catch (error) {
        if (isClerk) {
          console.log(Date.now(), '[AUTH-DEBUG] clerk fetch FAILED', {
            url,
            ms: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        throw error
      }
    }

    return () => {
      // keep patch for session; clearing flag only on full reload
    }
  }, [])

  const pendingShareSettingsRef = React.useRef<{
    accessLevel: ShareAccessType
    isPrivateLink: boolean
    sharePassword?: string
    previewOnly?: boolean
  } | null>(null)
  const pendingOpenShareModalRef = React.useRef<boolean>(false)

  // Web Crypto Key and E2EE state (In-memory ONLY, NEVER persisted to IndexedDB or localStorage)
  const activeKeyRef = React.useRef<CryptoKey | null>(
    cachedRootSession?.activeKey ?? null
  )
  const activeKeyStringRef = React.useRef<string | null>(
    cachedRootSession?.activeKeyString ?? null
  )
  const documentSaltRef = React.useRef<string | null>(
    initialRecord?.salt || cachedRootSession?.documentSalt || null
  )
  const encryptedPayloadRef = React.useRef<{
    ciphertext: string
    iv: string
  } | null>(
    initialRecord?.ciphertext && initialRecord?.iv
      ? { ciphertext: initialRecord.ciphertext, iv: initialRecord.iv }
      : (cachedRootSession?.encryptedPayload ?? null)
  )
  const [decryptionError, setDecryptionError] = useState<string | null>(null)
  const [, setIsDecrypting] = useState<boolean>(false)

  // Use the new Web Worker for off-thread parsing and tree/graph building
  const {
    processJson,
    reset: resetWorker,
    state: workerState,
  } = useJsonWorker()

  const [isEditorReady, setIsEditorReady] = useState(false)
  const [graphNodes, setGraphNodes] = useState<Node[]>([])
  const [graphEdges, setGraphEdges] = useState<Edge[]>([])
  const [treeNodes, setTreeNodes] = useState<TreeNodeSlim[]>([])
  const [parsedJsonData, setParsedJsonData] = useState<any>(null)
  const [currentViewMode, setCurrentViewMode] = useState<
    'visualize' | 'tree' | 'formatter'
  >(cachedRootSession?.viewMode || effectiveViewMode)

  const [documentType, setDocumentType] =
    useState<ShareType>(effectiveFeatureMode)

  const [isJsonValid, setIsJsonValid] = useState<boolean>(true)
  const [isGraphTooLarge, setIsGraphTooLarge] = useState<boolean>(false)
  const [isLayoutCalculating, setIsLayoutCalculating] = useState<boolean>(
    effectiveViewMode === 'visualize'
  )
  const [isClipboardCopied, setIsClipboardCopied] = useState<boolean>(false)
  const [jsonValidationError, setJsonValidationError] = useState<{
    message: string
    line?: number
    severity?: 'error' | 'warning'
  } | null>(null)

  const [monacoValidationError, setMonacoValidationError] = useState<{
    message: string
    line?: number
    severity?: 'error' | 'warning'
  } | null>(null)

  const [toastState, setToastState] = useState({ isOpen: false, message: '' })
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [localDocuments, setLocalDocuments] = useState<LocalDocumentRecord[]>(
    []
  )

  const effectiveValidationError = jsonValidationError || monacoValidationError
  const isDocValid =
    isJsonValid &&
    (!monacoValidationError || monacoValidationError.severity !== 'error')


  // Split state:
  // 1. currentJsonContent = Source of Truth for Saving/Graph (Updated by local typing)
  // 2. syncedRemoteContent = Source of Truth for Editor Display (Updated ONLY by Socket/System)
  const [syncedRemoteContent, setSyncedRemoteContent] = useState<{
    code: string
    nonce: number
  } | null>(() =>
    cachedRootSession
      ? { code: cachedRootSession.content, nonce: Date.now() }
      : null
  )

  const [indentationSize, setIndentationSize] = useState<string>('2')

  // Loading State
  const [isPageLoading, setIsPageLoading] = useState(
    !!urlSlug && initialRecord?.slug !== urlSlug
  )

  // Share State
  const [documentSlug, setDocumentSlug] = useState<string | null>(
    initialRecord?.slug || cachedRootSession?.slug || null
  )
  const [isDocumentPrivate, setIsDocumentPrivate] = useState(
    cachedRootSession?.isDocumentPrivate ?? (initialRecord?.isPrivate || false)
  )
  const [isPreviewOnly, setIsPreviewOnly] = useState(
    initialRecord?.previewOnly === true
  )
  const [documentOwnerId, setDocumentOwnerId] = useState<string | null>(
    initialRecord?.ownerId ?? null
  )
  const [hasOwnerKeyWrapped, setHasOwnerKeyWrapped] = useState(
    initialRecord?.hasOwnerKeyWrapped === true
  )
  const [userAccessLevel, setUserAccessLevel] = useState<ShareAccessType>(
    cachedRootSession?.userAccessLevel || initialRecord?.accessType || 'viewer'
  )

  const [isCurrentUserOwner, setIsCurrentUserOwner] = useState(
    cachedRootSession?.isCurrentUserOwner ?? false
  )

  // Shared markdown links with previewOnly: non-owners get article view only.
  // Owners keep the full editor even when the flag is on for recipients.
  const isMarkdownPreviewOnlyShare =
    documentType === 'markdown' &&
    isPreviewOnly &&
    !isCurrentUserOwner &&
    Boolean(urlSlug || documentSlug)


  // Helper to determine ownership (moved before canEdit initialization)
  const checkOwnership = useCallback((targetSlug: string) => {
    const ownedSlugs = Cookies.get('json-rock-owned')
    if (ownedSlugs) {
      try {
        const parsed = JSON.parse(ownedSlugs)
        if (Array.isArray(parsed) && parsed.includes(targetSlug)) {
          return true
        }
      } catch (e) {
        console.error('Cookie parse error', e)
      }
    }
    return false
  }, [])

  // Initialize hasEditPermission based on initialRecord to prevent race condition
  const [hasEditPermission, setHasEditPermission] = useState(() => {
    if (cachedRootSession) return cachedRootSession.hasEditPermission
    if (!initialRecord?.slug) return true // New document - always editable
    const isOwned = checkOwnership(initialRecord.slug)
    if (isOwned) return true // Owner always can edit
    return initialRecord.accessType === 'editor' // Non-owner: check accessType
  })

  const [documentPassword, setDocumentPassword] = useState(
    cachedRootSession?.documentPassword ?? ''
  )
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false)
  // Track if the record is indefinitely private (persisted as private)
  const [isPrivacyLocked, setIsPrivacyLocked] = useState(
    cachedRootSession?.isPrivacyLocked ?? (initialRecord?.isPrivate || false)
  )

  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Locked State for Private Links — defer password UI until owner-unlock check finishes
  const [isPasswordLocked, setIsPasswordLocked] = useState(() => {
    if (cachedRootSession) return cachedRootSession.isPasswordLocked
    if (
      initialRecord?.isPrivate &&
      !initialRecord?.json &&
      initialRecord?.schemaVersion !== 1 &&
      !initialRecord?.isLegacyPlaintext
    ) {
      return false
    }
    return Boolean(initialRecord?.isPrivate && !initialRecord?.json)
  })
  const [isOwnerUnlockPending, setIsOwnerUnlockPending] = useState(() => {
    if (cachedRootSession && !cachedRootSession.isPasswordLocked) return false
    return Boolean(
      initialRecord?.isPrivate &&
        !initialRecord?.json &&
        initialRecord?.schemaVersion !== 1 &&
        !initialRecord?.isLegacyPlaintext
    )
  })
  /** Bumps when private ciphertext is ready so owner-unlock can re-run safely. */
  const [ownerUnlockNonce, setOwnerUnlockNonce] = useState(0)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockErrorMessage, setUnlockErrorMessage] = useState<string | null>(
    null
  )
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  /**
   * Generates or imports the active AES-256-GCM encryption key for the current document.
   */
  const getOrCreateDocumentKey = useCallback(async (): Promise<{
    key: CryptoKey
    keyString?: string
  }> => {
    if (activeKeyRef.current) {
      return {
        key: activeKeyRef.current,
        keyString: activeKeyStringRef.current || undefined,
      }
    }

    // Check URL fragment first
    const fragmentKey = extractKeyFromFragment()
    if (fragmentKey) {
      try {
        const key = await importKeyFromFragment(fragmentKey)
        activeKeyRef.current = key
        activeKeyStringRef.current = fragmentKey
        return { key, keyString: fragmentKey }
      } catch (e) {
        console.error('Failed to import key from fragment', e)
      }
    }

    // Generate new key
    const { key, keyString } = await generateDocumentKey()
    activeKeyRef.current = key
    activeKeyStringRef.current = keyString
    setKeyInFragment(keyString)
    return { key, keyString }
  }, [])

  /**
   * Decrypts record ciphertext and populates editor state.
   */
  const decryptAndApplyData = useCallback(
    async (data: any, customPassword?: string) => {
      setIsDecrypting(true)
      setDecryptionError(null)
      setUnlockErrorMessage(null)

      const ciphertext = data.ciphertext || ''
      const iv = data.iv || ''
      const salt = data.salt || null
      const isPrivate = data.isPrivate || false

      documentSaltRef.current = salt
      encryptedPayloadRef.current = { ciphertext, iv }

      setDocumentSlug(data.slug || null)
      setIsDocumentPrivate(isPrivate)
      setIsPreviewOnly(data.previewOnly === true)
      setDocumentOwnerId(data.ownerId || null)
      setHasOwnerKeyWrapped(data.hasOwnerKeyWrapped === true)
      setUserAccessLevel(data.accessType || 'viewer')
      setDocumentType(data.type || 'json')
      setCurrentViewMode(paramView || data.mode || 'visualize')

      if (data.slug) {
        const isOwned = checkOwnership(data.slug)
        if (isOwned) {
          setIsCurrentUserOwner(true)
          setHasEditPermission(true)
        } else {
          setHasEditPermission(data.accessType === 'editor')
          setIsCurrentUserOwner(false)
        }
      } else {
        setIsCurrentUserOwner(true)
        setHasEditPermission(true)
      }

      // Handle Legacy Plaintext Documents (schemaVersion missing or 1)
      const isLegacy = Boolean(
        data.isLegacyPlaintext || data.schemaVersion === 1
      )
      if (isLegacy) {
        setIsLegacyDocument(true)
        setShowMigrationBanner(true)
        setIsDecrypting(false)

        let content = ''
        if (
          data.type === 'json' &&
          typeof data.data === 'object' &&
          data.data !== null
        ) {
          content = JSON.stringify(data.data, null, 2)
        } else {
          content = data.data || data.json || ''
        }

        if (isPrivate) {
          setIsPrivacyLocked(true)
          const isLocked = data.data === null || data.data === undefined
          setIsPasswordLocked(isLocked)
        } else {
          setIsPasswordLocked(false)
          setIsPrivacyLocked(false)
        }

        if (content || !isPrivate) {
          setCurrentJsonContent(content)
          setSyncedRemoteContent({ code: content, nonce: Date.now() })
          lastPersistedContentRef.current = content
        }
        return
      }

      setIsLegacyDocument(false)
      setShowMigrationBanner(false)

      // If empty ciphertext (newly created doc)
      if (!ciphertext) {
        const defaultContent = getDefaultEditorContent(data.type || 'json')
        setCurrentJsonContent(defaultContent)
        setSyncedRemoteContent({ code: defaultContent, nonce: Date.now() })
        lastPersistedContentRef.current = defaultContent
        setIsPasswordLocked(false)
        setIsOwnerUnlockPending(false)
        setIsPrivacyLocked(isPrivate)
        setIsDecrypting(false)
        return
      }

      try {
        let key: CryptoKey | null = null

        if (isPrivate) {
          const pwd = customPassword || documentPassword
          if (!pwd) {
            // Defer password UI — owner may unwrap via Clerk without a prompt flash
            setIsPrivacyLocked(true)
            setIsPasswordLocked(false)
            setOwnerUnlockNonce((n) => n + 1)
            setIsOwnerUnlockPending(true)
            setIsDecrypting(false)
            return
          }
          if (!salt) {
            throw new Error(
              'Missing encryption salt for password-protected document'
            )
          }
          key = await deriveKeyFromPassword(pwd, salt)
          activeKeyRef.current = key
          setIsOwnerUnlockPending(false)
        } else {
          const keyString = extractKeyFromFragment()
          if (!keyString) {
            setDecryptionError(
              'This document is end-to-end encrypted, but no encryption key was found in the link. Please ensure your link includes the #key=... fragment.'
            )
            setIsDecrypting(false)
            return
          }
          key = await importKeyFromFragment(keyString)
          activeKeyRef.current = key
          activeKeyStringRef.current = keyString
        }

        const plaintext = await decryptContent(ciphertext, iv, key)
        setCurrentJsonContent(plaintext)
        setSyncedRemoteContent({ code: plaintext, nonce: Date.now() })
        lastPersistedContentRef.current = plaintext
        setIsPasswordLocked(false)
        setIsPrivacyLocked(isPrivate)
        setDecryptionError(null)
      } catch (err) {
        console.error('Decryption failed:', err)
        if (isPrivate) {
          setUnlockErrorMessage('Incorrect password. Unable to decrypt.')
          setIsPasswordLocked(true)
        } else {
          setDecryptionError(
            'Failed to decrypt document. The encryption key in the URL may be invalid or corrupted.'
          )
        }
      } finally {
        setIsDecrypting(false)
      }
    },
    [checkOwnership, documentPassword, paramView]
  )

  // Owner bypass: unwrap content key via authenticated endpoint before password UI
  useEffect(() => {
    if (!isOwnerUnlockPending) return
    if (!isAuthLoaded || !isUserLoaded) return

    const payload = encryptedPayloadRef.current
    // Wait until decryptAndApplyData has stored the ciphertext (avoid racing mount)
    if (!payload?.ciphertext || !payload?.iv) return

    let cancelled = false

    ;(async () => {
      const slug = documentSlug || urlSlug || initialRecord?.slug || null
      const canTry =
        Boolean(isSignedIn) &&
        Boolean(clerkUserId) &&
        Boolean(documentOwnerId) &&
        clerkUserId === documentOwnerId &&
        hasOwnerKeyWrapped &&
        Boolean(slug)

      if (canTry && slug) {
        try {
          const key = await tryOwnerUnwrapContentKey(slug, getToken)
          if (key && !cancelled) {
            const plaintext = await decryptContent(
              payload.ciphertext,
              payload.iv,
              key
            )
            activeKeyRef.current = key
            activeKeyStringRef.current = null
            setCurrentJsonContent(plaintext)
            setSyncedRemoteContent({ code: plaintext, nonce: Date.now() })
            lastPersistedContentRef.current = plaintext
            setIsPasswordLocked(false)
            setIsPrivacyLocked(true)
            setIsCurrentUserOwner(true)
            setHasEditPermission(true)
            setDecryptionError(null)
            setIsOwnerUnlockPending(false)
            return
          }
        } catch (err) {
          console.warn('Owner key unwrap failed; falling back to password', err)
        }
      }

      if (!cancelled) {
        setIsPasswordLocked(true)
        setIsPrivacyLocked(true)
        setIsOwnerUnlockPending(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    isOwnerUnlockPending,
    ownerUnlockNonce,
    isAuthLoaded,
    isUserLoaded,
    isSignedIn,
    clerkUserId,
    documentOwnerId,
    hasOwnerKeyWrapped,
    documentSlug,
    urlSlug,
    initialRecord?.slug,
    getToken,
  ])

  const syncFromLocalRecord = useCallback(
    (record: LocalDocumentRecord) => {
      const content = record.content || ''
      const resolvedMode: JsonShareMode =
        record.type === 'json'
          ? paramView || record.mode || 'visualize'
          : 'formatter'

      setCurrentJsonContent(content)
      setDocumentSlug(record.slug)
      setDocumentType(record.type)
      setIsDocumentPrivate(record.isPrivate)
      setIsPreviewOnly(false)
      setUserAccessLevel(record.accessType)
      setCurrentViewMode(resolvedMode)
      setSyncedRemoteContent({ code: content, nonce: Date.now() })

      setIsPasswordLocked(false)
      setIsPrivacyLocked(record.isPrivate)
      setHasEditPermission(true)
      setIsCurrentUserOwner(true)

      lastPersistedContentRef.current = content
    },
    [paramView]
  )

  const applyTabSnapshot = useCallback((snapshot: EditorTabSnapshot) => {
    setCurrentJsonContent(snapshot.content)
    setDocumentSlug(snapshot.slug)
    setDocumentType(snapshot.type)
    setCurrentViewMode(snapshot.viewMode)
    setIsDocumentPrivate(snapshot.isDocumentPrivate)
    setUserAccessLevel(snapshot.userAccessLevel)
    setHasEditPermission(snapshot.hasEditPermission)
    setIsCurrentUserOwner(snapshot.isCurrentUserOwner)
    setIsPrivacyLocked(snapshot.isPrivacyLocked)
    setIsPasswordLocked(snapshot.isPasswordLocked)
    setIsLegacyDocument(snapshot.isLegacyDocument)
    setShowMigrationBanner(snapshot.showMigrationBanner)
    setDocumentPassword(snapshot.documentPassword)
    setSyncedRemoteContent({
      code: snapshot.content,
      nonce: Date.now(),
    })
    lastPersistedContentRef.current = snapshot.lastPersistedContent
    activeKeyRef.current = snapshot.activeKey
    activeKeyStringRef.current = snapshot.activeKeyString
    documentSaltRef.current = snapshot.documentSalt
    encryptedPayloadRef.current = snapshot.encryptedPayload
    setDecryptionError(null)
  }, [])

  // Track whether this is the first mount — SSR already provided initialRecord, no need to re-fetch
  const isInitialMountRef = React.useRef(!!initialRecord)

  // Ref to prevent initial fetch when we JUST created the slug via auto-save
  const justAutoSavedSlugRef = React.useRef<string | null>(null)
  const lastRootNavKeyRef = React.useRef<string | null>(null)
  const hydratedFromCacheRef = React.useRef(!!cachedRootSession)

  const restoreSessionUrl = useCallback((snapshot: EditorTabSnapshot) => {
    if (typeof window === 'undefined' || !snapshot.slug) return

    const route = `${getEditorBasePath(snapshot.type)}/`
    const viewParam =
      snapshot.type === 'text' ||
      snapshot.type === 'markdown' ||
      snapshot.type === 'html'
        ? ''
        : `?view=${snapshot.viewMode}`
    const fragment = snapshot.activeKeyString
      ? `#key=${snapshot.activeKeyString}`
      : ''
    const newUrl = `${route}${snapshot.slug}${viewParam}${fragment}`

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
    const basePath = getEditorBasePath(snapshot.type)
    if (currentPath === basePath) {
      justAutoSavedSlugRef.current = snapshot.slug
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        '',
        newUrl
      )
    }
  }, [])

  // Restore this type's in-memory session before paint so tab switches don't
  // flash default content. useState also hydrates from the same store on
  // client remounts; this covers the case where SSR rendered defaults.
  useLayoutEffect(() => {
    if (urlSlug || initialRecord) return

    const cached = getEditorTabSession(featureMode)
    if (!cached) return

    if (!hydratedFromCacheRef.current) {
      applyTabSnapshot(cached)
    }
    restoreSessionUrl(cached)
    lastRootNavKeyRef.current = `root:${featureMode}`
    setIsPageLoading(false)
  }, [
    urlSlug,
    initialRecord,
    featureMode,
    applyTabSnapshot,
    restoreSessionUrl,
  ])

  // Initial SSR Hydration & Key Decryption
  useEffect(() => {
    if (initialRecord && initialRecord.slug) {
      decryptAndApplyData(initialRecord)
    }
  }, []) // Mount only

  // Sync state when URL slug changes (Navigation / Refresh)
  useEffect(() => {
    if (urlSlug) {
      lastRootNavKeyRef.current = null

      if (justAutoSavedSlugRef.current === urlSlug) {
        justAutoSavedSlugRef.current = null
        return
      }

      if (isInitialMountRef.current) {
        isInitialMountRef.current = false
        setIsPageLoading(false)

        const isOwnedOnClient = checkOwnership(urlSlug)
        if (isOwnedOnClient) {
          setIsCurrentUserOwner(true)
          setHasEditPermission(true)
        }

        return
      }

      // Subsequent navigations: fetch fresh data
      setIsPageLoading(true)
      const controller = new AbortController()

      const loadDocument = async () => {
        try {
          const res = await fetch(`/api/share/${urlSlug}`, {
            signal: controller.signal,
          })

          if (!res.ok) {
            throw new Error('Failed to load')
          }

          const data = await res.json()
          if (data && !data.error) {
            await decryptAndApplyData(data)
            return
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            return
          }

          try {
            const localRecord = await getLocalDocumentBySlug(urlSlug)
            if (localRecord && !controller.signal.aborted) {
              syncFromLocalRecord(localRecord)
              setToastState({
                isOpen: true,
                message:
                  'Loaded from local browser storage (remote record unavailable).',
              })
              return
            }
          } catch (localError) {
            console.error('Local fallback error', localError)
          }

          console.error('Fetch error', err)
        } finally {
          if (!controller.signal.aborted) {
            setIsPageLoading(false)
          }
        }
      }

      loadDocument()

      return () => controller.abort()
    } else {
      // NAVIGATED TO ROOT (New File) — or switched back to this editor type.
      // Do not re-run on unrelated callback identity changes: that wipes typing.
      const rootNavKey = `root:${featureMode}`
      if (lastRootNavKeyRef.current === rootNavKey) {
        setIsPageLoading(false)
        return
      }
      lastRootNavKeyRef.current = rootNavKey
      isInitialMountRef.current = false

      const cached = getEditorTabSession(featureMode)
      if (cached) {
        if (!hydratedFromCacheRef.current) {
          applyTabSnapshot(cached)
        }
        hydratedFromCacheRef.current = false
        restoreSessionUrl(cached)
        setIsPageLoading(false)
        return
      }

      const defaultContent = getDefaultEditorContent(featureMode)

      setCurrentJsonContent(defaultContent)
      setDocumentSlug(null)
      setIsDocumentPrivate(false)
      setIsPreviewOnly(false)
      setUserAccessLevel('viewer')
      setDocumentType(featureMode)
      if (
        featureMode !== 'text' &&
        featureMode !== 'markdown' &&
        featureMode !== 'html'
      ) {
        setCurrentViewMode(paramView || 'visualize')
      }
      setIsCurrentUserOwner(true)
      setHasEditPermission(true)
      setSyncedRemoteContent({ code: defaultContent, nonce: Date.now() })
      lastPersistedContentRef.current = defaultContent
      activeKeyRef.current = null
      activeKeyStringRef.current = null
      documentSaltRef.current = null
      encryptedPayloadRef.current = null
      setDecryptionError(null)
      resetWorker()
      setIsPageLoading(false)
    }
  }, [
    urlSlug,
    featureMode,
    decryptAndApplyData,
    syncFromLocalRecord,
    applyTabSnapshot,
    restoreSessionUrl,
    resetWorker,
    checkOwnership,
    paramView,
  ])

  // Sync currentViewMode with URL parameter changes (for browser back/forward navigation)
  useEffect(() => {
    if (paramView && paramView !== currentViewMode) {
      setCurrentViewMode(paramView)
    }
  }, [paramView])

  const addOwnership = (newSlug: string) => {
    const owned = Cookies.get('json-rock-owned')
    let slugs: string[] = []
    if (owned) {
      try {
        slugs = JSON.parse(owned)
      } catch (e) {}
    }
    if (!slugs.includes(newSlug)) {
      slugs.push(newSlug)
      Cookies.set('json-rock-owned', JSON.stringify(slugs), {
        expires: 30,
        path: '/',
      }) // 30 days
    }
    setIsCurrentUserOwner(true)
  }

  // Refs for stable callback access
  const slugRef = React.useRef(documentSlug)
  const isLockedRef = React.useRef(isPasswordLocked)
  const isPrivateRef = React.useRef(isDocumentPrivate)
  const isValidRef = React.useRef(isJsonValid)

  useEffect(() => {
    slugRef.current = documentSlug
    isLockedRef.current = isPasswordLocked
    isPrivateRef.current = isDocumentPrivate
    isValidRef.current = isJsonValid
  }, [documentSlug, isPasswordLocked, isDocumentPrivate, isJsonValid])

  const isPageLoadingRef = React.useRef(isPageLoading)
  isPageLoadingRef.current = isPageLoading

  const tabSnapshotRef = React.useRef<EditorTabSnapshot>({
    type: documentType,
    content: currentJsonContent,
    slug: documentSlug,
    viewMode: currentViewMode,
    isDocumentPrivate,
    userAccessLevel,
    hasEditPermission,
    isCurrentUserOwner,
    isPrivacyLocked,
    isPasswordLocked,
    isLegacyDocument,
    showMigrationBanner,
    lastPersistedContent: lastPersistedContentRef.current,
    documentPassword,
    activeKey: activeKeyRef.current,
    activeKeyString: activeKeyStringRef.current,
    documentSalt: documentSaltRef.current,
    encryptedPayload: encryptedPayloadRef.current,
  })

  tabSnapshotRef.current = {
    type: documentType,
    content: currentJsonContent,
    slug: documentSlug,
    viewMode: currentViewMode,
    isDocumentPrivate,
    userAccessLevel,
    hasEditPermission,
    isCurrentUserOwner,
    isPrivacyLocked,
    isPasswordLocked,
    isLegacyDocument,
    showMigrationBanner,
    lastPersistedContent: lastPersistedContentRef.current,
    documentPassword,
    activeKey: activeKeyRef.current,
    activeKeyString: activeKeyStringRef.current,
    documentSalt: documentSaltRef.current,
    encryptedPayload: encryptedPayloadRef.current,
  }

  useEffect(() => {
    if (isPageLoading) return
    setEditorTabSession(documentType, tabSnapshotRef.current)
  }, [
    currentJsonContent,
    documentSlug,
    documentType,
    currentViewMode,
    isDocumentPrivate,
    userAccessLevel,
    hasEditPermission,
    isCurrentUserOwner,
    isPrivacyLocked,
    isPasswordLocked,
    isLegacyDocument,
    showMigrationBanner,
    documentPassword,
    isPageLoading,
  ])

  useEffect(() => {
    return () => {
      const snapshot = tabSnapshotRef.current
      if (isPageLoadingRef.current && !snapshot.slug) return
      setEditorTabSession(snapshot.type, snapshot)
      if (!snapshot.slug || snapshot.isPasswordLocked) return

      void saveLocalDocument({
        slug: snapshot.slug,
        type: snapshot.type,
        mode: snapshot.type === 'json' ? snapshot.viewMode : 'formatter',
        content: snapshot.content,
        isPrivate: snapshot.isDocumentPrivate,
        accessType: snapshot.userAccessLevel,
      }).catch((error) => {
        console.error('Failed to flush local document on tab switch', error)
      })
    }
  }, [])

  const emitTimeout = React.useRef<NodeJS.Timeout | null>(null)

  // Stable Change Handler
  const onJsonContentChange = useCallback((newCode: string | undefined) => {
    const code = newCode || ''
    setCurrentJsonContent(code)

    // Debounce socket emission to prevent flooding/lag
    if (emitTimeout.current) clearTimeout(emitTimeout.current)

    emitTimeout.current = setTimeout(async () => {
      // Emit encrypted change if we have a slug and aren't locked
      if (slugRef.current && !isLockedRef.current && activeKeyRef.current) {
        const socket = getSocket()
        if (socket && socket.connected) {
          try {
            const encrypted = await encryptContent(code, activeKeyRef.current)
            socket.emit('code-change', {
              slug: slugRef.current,
              newCode: JSON.stringify(encrypted),
            })
          } catch (e) {
            console.error('Socket encryption failed', e)
          }
        }
      }
    }, 100)
  }, [])

  // Socket Effect - OPTIMIZED for Production with E2EE Relay
  useEffect(() => {
    if (!documentSlug) return
    if (isDocumentPrivate && isPasswordLocked) return

    const socket = getSocket()

    const onConnect = () => {
      socket.emit('join-room', documentSlug)
    }

    const onCodeChange = async (payloadStr: string) => {
      if (!activeKeyRef.current) return
      try {
        let payload: { ciphertext: string; iv: string }
        try {
          payload = JSON.parse(payloadStr)
        } catch {
          return
        }

        if (payload.ciphertext && payload.iv) {
          const newCode = await decryptContent(
            payload.ciphertext,
            payload.iv,
            activeKeyRef.current
          )
          setCurrentJsonContent(newCode)
          setSyncedRemoteContent({ code: newCode, nonce: Date.now() })
          lastPersistedContentRef.current = newCode
        }
      } catch (e) {
        console.error('Failed to decrypt incoming socket message', e)
      }
    }

    if (!socket.connected) {
      socket.connect()
    } else {
      onConnect()
    }

    socket.on('connect', onConnect)
    socket.on('code-change', onCodeChange)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('code-change', onCodeChange)
      socket.emit('leave-room', documentSlug)
    }
  }, [documentSlug, isPasswordLocked, isDocumentPrivate])

  // Alert State
  const [alertState, setAlertState] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })

  const triggerAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) => {
    setAlertState({ isOpen: true, title, message, type })
  }

  const dismissAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }))
  }

  const openHistoryModal = useCallback(() => {
    // Show loader on the first paint — don't flash stale IndexedDB results
    setIsHistoryLoading(true)
    setLocalDocuments([])
    setIsHistoryModalOpen(true)
  }, [])

  const getRouteForDocument = useCallback(
    (type: ShareType, slug: string, mode?: JsonShareMode) => {
      const basePath = `${getEditorBasePath(type)}/`
      const viewParam = type === 'json' ? `?view=${mode || 'visualize'}` : ''
      return `${basePath}${slug}${viewParam}`
    },
    []
  )

  const handleOpenLocalDocument = useCallback(
    (record: LocalDocumentRecord) => {
      syncFromLocalRecord(record)
      const nextUrl = getRouteForDocument(record.type, record.slug, record.mode)

      window.history.pushState(
        { ...window.history.state, as: nextUrl, url: nextUrl },
        '',
        nextUrl
      )

      setIsHistoryModalOpen(false)
    },
    [getRouteForDocument, syncFromLocalRecord]
  )

  const handleDeleteLocalDocument = useCallback(async (slug: string) => {
    try {
      await deleteLocalDocumentBySlug(slug)
      setLocalDocuments((prev) => prev.filter((item) => item.slug !== slug))
    } catch (error) {
      console.error('Failed to delete local document', error)
    }
  }, [])

  const handleRenameLocalDocument = useCallback(
    async (slug: string, title: string) => {
      try {
        const updated = await updateLocalDocumentTitle(slug, title)
        if (!updated) return null

        setLocalDocuments((previous) => {
          const remaining = previous.filter(
            (item) => item.slug !== updated.slug
          )
          return [updated, ...remaining].sort(
            (a, b) => b.updatedAt - a.updatedAt
          )
        })

        return updated
      } catch (error) {
        console.error('Failed to rename local document', error)
        return null
      }
    },
    []
  )

  const handleClearLocalDocuments = useCallback(async () => {
    try {
      await clearLocalDocuments()
      setLocalDocuments([])
    } catch (error) {
      console.error('Failed to clear local history', error)
    }
  }, [])

  useEffect(() => {
    if (!isHistoryModalOpen) return

    let cancelled = false

    const load = async () => {
      setIsHistoryLoading(true)
      try {
        const records = await listLocalDocuments()
        if (!cancelled) setLocalDocuments(records)
      } catch (error) {
        console.error('Failed to load local history', error)
        if (!cancelled) setLocalDocuments([])
      } finally {
        if (!cancelled) setIsHistoryLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [isHistoryModalOpen])

  const debouncedContentForLocalStorage = useDebounce(currentJsonContent, 800)

  useEffect(() => {
    if (!documentSlug) return
    if (isPasswordLocked) return

    const modeToStore: JsonShareMode =
      documentType === 'json' ? currentViewMode : 'formatter'

    saveLocalDocument({
      slug: documentSlug,
      type: documentType,
      mode: modeToStore,
      content: debouncedContentForLocalStorage,
      isPrivate: isDocumentPrivate,
      accessType: userAccessLevel,
    })
      .then((savedRecord) => {
        if (!savedRecord) return

        setLocalDocuments((previous) => {
          const remaining = previous.filter(
            (item) => item.slug !== savedRecord.slug
          )
          return [savedRecord, ...remaining].sort(
            (a, b) => b.updatedAt - a.updatedAt
          )
        })
      })
      .catch((error) => {
        console.error('Failed to store local document', error)
      })
  }, [
    documentSlug,
    documentType,
    currentViewMode,
    debouncedContentForLocalStorage,
    isDocumentPrivate,
    userAccessLevel,
    isPasswordLocked,
  ])

  const handleUnlockDocument = async () => {
    if (!documentPassword) return
    setIsUnlocking(true)
    setUnlockErrorMessage(null)

    const slug = documentSlug || initialRecord?.slug

    if (isLegacyDocument) {
      // Legacy unlock: check password against backend SHA-256 hash
      try {
        const res = await fetch(`/api/share/${slug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: documentPassword }),
        })
        const data = await res.json()
        if (!res.ok) {
          setUnlockErrorMessage(data.error || 'Invalid password')
          return
        }

        let content = ''
        if (
          data.type === 'json' &&
          typeof data.data === 'object' &&
          data.data !== null
        ) {
          content = JSON.stringify(data.data, null, 2)
        } else {
          content = data.data || data.json || ''
        }

        setCurrentJsonContent(content)
        setSyncedRemoteContent({ code: content, nonce: Date.now() })
        lastPersistedContentRef.current = content
        setIsPasswordLocked(false)
        setIsPrivacyLocked(true)
        setUnlockErrorMessage(null)

        if (slug) {
          const ownedSlugs = Cookies.get('json-rock-owned')
          if (ownedSlugs) {
            try {
              const parsed = JSON.parse(ownedSlugs)
              if (Array.isArray(parsed) && parsed.includes(slug)) {
                setIsCurrentUserOwner(true)
                setHasEditPermission(true)
              }
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error('Legacy unlock error:', err)
        setUnlockErrorMessage('Failed to unlock document.')
      } finally {
        setIsUnlocking(false)
      }
      return
    }

    // E2EE (v2) Unlock: client-side PBKDF2 decryption
    try {
      const salt = documentSaltRef.current
      const payload = encryptedPayloadRef.current
      if (!salt || !payload?.ciphertext) {
        throw new Error('No encrypted data or salt found to unlock')
      }

      const key = await deriveKeyFromPassword(documentPassword, salt)
      const plaintext = await decryptContent(
        payload.ciphertext,
        payload.iv,
        key
      )

      activeKeyRef.current = key
      activeKeyStringRef.current = null
      setCurrentJsonContent(plaintext)
      setSyncedRemoteContent({ code: plaintext, nonce: Date.now() })
      lastPersistedContentRef.current = plaintext
      setIsPasswordLocked(false)
      setIsPrivacyLocked(true)
      setUnlockErrorMessage(null)

      if (slug) {
        const ownedSlugs = Cookies.get('json-rock-owned')
        if (ownedSlugs) {
          try {
            const parsed = JSON.parse(ownedSlugs)
            if (Array.isArray(parsed) && parsed.includes(slug)) {
              setIsCurrentUserOwner(true)
              setHasEditPermission(true)
            }
          } catch (e) {}
        }
        if (clerkUserId && documentOwnerId && clerkUserId === documentOwnerId) {
          setIsCurrentUserOwner(true)
          setHasEditPermission(true)
        }
      }

      // Backfill ownerKeyWrapped after password unlock (enables cross-device owner bypass)
      if (isSignedIn && slug) {
        try {
          const wrapped = await buildOwnerKeyWrapped(key, getToken)
          if (wrapped) {
            let token: string | null = null
            try {
              token = await getToken()
            } catch {
              token = null
            }
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }
            if (token) headers.Authorization = `Bearer ${token}`

            const putRes = await fetch(`/api/share/${slug}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                schemaVersion: 2,
                ciphertext: payload.ciphertext,
                iv: payload.iv,
                salt,
                mode: currentViewMode,
                isPrivate: true,
                accessType: userAccessLevel,
                type: documentType,
                ownerKeyWrapped: wrapped,
              }),
            })
            if (putRes.ok) {
              setHasOwnerKeyWrapped(true)
              const putData = await putRes.json()
              if (putData.ownerId) setDocumentOwnerId(putData.ownerId)
            }
          }
        } catch (wrapErr) {
          console.warn('Failed to backfill ownerKeyWrapped', wrapErr)
        }
      }
    } catch (err) {
      console.error('Unlock error:', err)
      setUnlockErrorMessage('Incorrect password. Unable to decrypt.')
    } finally {
      setIsUnlocking(false)
    }
  }

  const cancelUnlockAttempt = () => {
    router.push('/editor')
  }

  // New Button Handler
  const handleCreateNewDocument = async (specificType?: ShareType) => {
    const targetType =
      typeof specificType === 'string' ? specificType : documentType
    const isText = targetType === 'text'
    const isMarkdown = targetType === 'markdown'
    const isHtml = targetType === 'html'
    const initialContent = isText
      ? '<p style="font-size: 14pt">Type your text here...</p>'
      : isMarkdown
        ? '# Hello Markdown\n\nStart typing...'
        : isHtml
          ? DEFAULT_HTML_CONTENT
          : '{\n  "project": "JSON ROCK",\n  "visualize": true,\n  "features": [\n    "Graph View",\n    "Tree View",\n    "Formatter"\n  ],\n  "metrics": {\n    "speed": 100,\n    "usability": "high"\n  }\n}'

    setCurrentJsonContent(initialContent)
    setDocumentSlug(null)
    setIsLegacyDocument(false)
    setShowMigrationBanner(false)
    setIsDocumentPrivate(false)
    setIsPreviewOnly(false)
    setIsPrivacyLocked(false)
    setUserAccessLevel('viewer')
    setHasEditPermission(true)
    setDocumentPassword('')
    setDecryptionError(null)
    setSyncedRemoteContent({
      code: initialContent,
      nonce: Date.now(),
    })

    if (!isText && !isMarkdown && !isHtml) {
      setCurrentViewMode('formatter')
    }

    setIsAutoSaving(true)
    try {
      const { key, keyString } = await generateDocumentKey()
      activeKeyRef.current = key
      activeKeyStringRef.current = keyString
      const { ciphertext, iv } = await encryptContent(initialContent, key)
      encryptedPayloadRef.current = { ciphertext, iv }

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 2,
          ciphertext,
          iv,
          mode: isText || isMarkdown || isHtml ? currentViewMode : 'formatter',
          type: targetType,
          accessType: 'editor',
          isPrivate: false,
        }),
      })
      const data = await res.json()
      if (data.slug) {
        setDocumentSlug(data.slug)
        setUserAccessLevel(data.accessType || 'editor')
        setHasEditPermission(true)
        setIsCurrentUserOwner(true)
        setDocumentType(data.type || targetType)
        addOwnership(data.slug)
        lastPersistedContentRef.current = initialContent

        const resolvedType = (data.type || targetType) as ShareType
        const route = `${getEditorBasePath(resolvedType)}/`
        const viewParam =
          resolvedType === 'text' ||
          resolvedType === 'markdown' ||
          resolvedType === 'html'
            ? ''
            : '?view=formatter'
        const newUrl = `${route}${data.slug}${viewParam}#key=${keyString}`

        window.history.pushState(
          { ...window.history.state, as: newUrl, url: newUrl },
          '',
          newUrl
        )
      }
    } catch (e) {
      console.error('Failed to create new record', e)
    } finally {
      setIsAutoSaving(false)
    }
  }

  // Save Button Handler
  const handleSaveDocument = async (silent = false) => {
    if (!documentSlug) return
    if (isPasswordLocked) return

    setIsAutoSaving(true)
    try {
      const wasLegacy = isLegacyDocument
      let key = activeKeyRef.current
      let salt = documentSaltRef.current
      let keyString: string | undefined = undefined

      if (isDocumentPrivate) {
        if (documentPassword.length < 4 && !key) {
          if (!silent)
            triggerAlert(
              'Invalid Password',
              'Password must be at least 4 characters for private links.',
              'error'
            )
          setIsAutoSaving(false)
          return
        }
        if (!salt || wasLegacy) {
          salt = generateSalt()
          documentSaltRef.current = salt
        }
        if (!key && documentPassword) {
          key = await deriveKeyFromPassword(documentPassword, salt)
          activeKeyRef.current = key
        }
      } else {
        if (!key) {
          const generated = await getOrCreateDocumentKey()
          key = generated.key
          keyString = generated.keyString
        }
      }

      if (!key) throw new Error('No encryption key available for saving')

      const { ciphertext, iv } = await encryptContent(currentJsonContent, key)
      encryptedPayloadRef.current = { ciphertext, iv }

      let ownerKeyWrapped: string | null = null
      if (isDocumentPrivate) {
        ownerKeyWrapped = await buildOwnerKeyWrapped(key, getToken)
      }

      let token: string | null = null
      try {
        token = await getToken()
      } catch {
        token = null
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(`/api/share/${documentSlug}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          schemaVersion: 2,
          ciphertext,
          iv,
          salt: isDocumentPrivate ? salt || undefined : undefined,
          mode: currentViewMode,
          isPrivate: isDocumentPrivate,
          accessType: userAccessLevel,
          type: documentType,
          ...(ownerKeyWrapped ? { ownerKeyWrapped } : {}),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        if (data.created) {
          addOwnership(documentSlug)
        }
        if (isDocumentPrivate) setIsPrivacyLocked(true)
        if (ownerKeyWrapped) setHasOwnerKeyWrapped(true)
        if (data.ownerId) setDocumentOwnerId(data.ownerId)
        lastPersistedContentRef.current = currentJsonContent

        // If this document was legacy, it is now migrated!
        if (wasLegacy) {
          setIsLegacyDocument(false)
          setShowMigrationBanner(false)

          // Update URL in-place to include #key=... for public links
          if (!isDocumentPrivate) {
            const resolvedType = documentType
            const route = `${getEditorBasePath(resolvedType)}/`
            const viewParam =
              resolvedType === 'text' ||
              resolvedType === 'markdown' ||
              resolvedType === 'html'
                ? ''
                : `?view=${currentViewMode}`
            const currentKey = keyString || activeKeyStringRef.current || ''
            const newUrl = `${route}${documentSlug}${viewParam}#key=${currentKey}`

            window.history.replaceState(
              { ...window.history.state, as: newUrl, url: newUrl },
              '',
              newUrl
            )
          }

          setToastState({
            isOpen: true,
            message:
              'Document upgraded to End-to-End Encryption! Share the updated link with collaborators.',
          })
        } else if (!silent) {
          triggerAlert(
            'Saved Successfully',
            'Your encrypted changes have been saved.',
            'success'
          )
        }
      } else {
        const err = data
        if (!silent)
          triggerAlert(
            'Save Failed',
            err.error || 'An error occurred while saving.',
            'error'
          )
      }
    } catch (e) {
      console.error('Failed to save', e)
      if (!silent)
        triggerAlert(
          'Save Failed',
          (e as Error).message || 'Network error or server unreachable.',
          'error'
        )
    } finally {
      setIsAutoSaving(false)
    }
  }

  // Resizable Pane Logic
  const [editorPanelWidthPercentage, setEditorPanelWidthPercentage] =
    useState(40) // Default 40%
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  /** Collapse the left JSON input pane; right preview stays visible. */
  const [isLeftEditorCollapsed, setIsLeftEditorCollapsed] = useState(false)

  const startResizing = useCallback(
    (mouseDownEvent: React.MouseEvent) => {
      mouseDownEvent.preventDefault()
      if (isLeftEditorCollapsed) return
      setIsResizingPanel(true)
    },
    [isLeftEditorCollapsed]
  )

  const stopResizing = useCallback(() => {
    setIsResizingPanel(false)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizingPanel && !isLeftEditorCollapsed) {
        const newWidth = (mouseMoveEvent.clientX / window.innerWidth) * 100
        // Constraint between 20% and 80%
        if (newWidth > 20 && newWidth < 80) {
          setEditorPanelWidthPercentage(newWidth)
        }
      }
    },
    [isResizingPanel, isLeftEditorCollapsed]
  )

  useEffect(() => {
    if (isResizingPanel) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizingPanel, resize, stopResizing])

  // Upload Logic
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isFileUploading, setIsFileUploading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [isDragOver, setIsDragOver] = useState(false)

  const processSelectedFile = async (file: File) => {
    const isJson =
      file.type === 'application/json' || file.name.endsWith('.json')
    const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.mdx')
    const isText = file.type === 'text/plain' || file.name.endsWith('.txt')

    // Restrict based on currently active documentType
    if (documentType === 'markdown') {
      if (!isMarkdown) {
        triggerAlert(
          'Upload Failed',
          'Please select a valid .md file.',
          'error'
        )
        if (fileInputRef.current) fileInputRef.current.value = ''
        setIsUploadModalOpen(false)
        return
      }
    } else if (documentType === 'json') {
      if (!isJson) {
        triggerAlert(
          'Upload Failed',
          'Please select a valid .json file.',
          'error'
        )
        if (fileInputRef.current) fileInputRef.current.value = ''
        setIsUploadModalOpen(false)
        return
      }
    } else {
      if (!isJson && !isMarkdown && !isText) {
        triggerAlert(
          'Upload Failed',
          'Please select a valid .json, .md, or .txt file.',
          'error'
        )
        if (fileInputRef.current) fileInputRef.current.value = ''
        setIsUploadModalOpen(false)
        return
      }
    }

    if (file.size > 2 * 1024 * 1024) {
      triggerAlert('Upload Failed', 'File size exceeds the 2MB limit.', 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setIsUploadModalOpen(false)
      return
    }

    setIsFileUploading(true)
    const fileContent = await file.text()

    try {
      const targetType = isJson ? 'json' : isMarkdown ? 'markdown' : 'text'
      const { key, keyString } = await generateDocumentKey()
      activeKeyRef.current = key
      activeKeyStringRef.current = keyString
      const { ciphertext, iv } = await encryptContent(fileContent, key)
      encryptedPayloadRef.current = { ciphertext, iv }

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext,
          iv,
          mode: isJson ? 'formatter' : 'visualize',
          type: targetType,
          accessType: 'editor',
          isPrivate: false,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      if (isJson) setCurrentViewMode('formatter')
      setDocumentType(targetType)
      setDocumentSlug(data.slug)
      addOwnership(data.slug)

      const routePrefix =
        targetType === 'json'
          ? '/editor/'
          : targetType === 'markdown'
            ? '/editor/markdown/'
            : '/editor/text/'
      const viewQuery = isJson ? '?view=formatter' : ''
      const newUrl = `${routePrefix}${data.slug}${viewQuery}#key=${keyString}`

      window.history.pushState(
        { ...window.history.state, as: newUrl, url: newUrl },
        '',
        newUrl
      )

      setCurrentJsonContent(fileContent)
      setSyncedRemoteContent({ code: fileContent, nonce: Date.now() })
      lastPersistedContentRef.current = fileContent

      setIsUploadModalOpen(false)
      setIsFileUploading(false)
    } catch (error) {
      console.error(error)
      triggerAlert('Upload Failed', (error as Error).message, 'error')
      setIsFileUploading(false)
    }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processSelectedFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (documentType === 'markdown') {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (documentType !== 'markdown') return

    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processSelectedFile(file)
  }

  const executeShareDocument = useCallback(
    async (
      settings: {
        accessLevel: ShareAccessType
        isPrivateLink: boolean
        sharePassword?: string
        previewOnly?: boolean
      },
      options?: { copyToClipboard?: boolean }
    ): Promise<string> => {
      setIsAutoSaving(true)
      const method = documentSlug ? 'PUT' : 'POST'
      const url = documentSlug ? `/api/share/${documentSlug}` : '/api/share'
      const copyToClipboard = options?.copyToClipboard !== false

      try {
        let token: string | null = null
        try {
          token = await getToken()
        } catch (e) {
          console.warn('Failed to retrieve Clerk auth token', e)
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        let key: CryptoKey
        let salt: string | undefined = undefined
        let keyString: string | undefined = undefined

        if (settings.isPrivateLink) {
          salt = generateSalt()
          documentSaltRef.current = salt
          key = await deriveKeyFromPassword(settings.sharePassword!, salt)
          activeKeyRef.current = key
          activeKeyStringRef.current = null
        } else {
          const generated = await getOrCreateDocumentKey()
          key = generated.key
          keyString = generated.keyString
        }

        const { ciphertext, iv } = await encryptContent(currentJsonContent, key)
        encryptedPayloadRef.current = { ciphertext, iv }

        let ownerKeyWrapped: string | null = null
        if (settings.isPrivateLink) {
          ownerKeyWrapped = await buildOwnerKeyWrapped(key, getToken)
        }

        const res = await fetch(url, {
          method,
          headers,
          body: JSON.stringify({
            schemaVersion: 2,
            ciphertext,
            iv,
            salt: settings.isPrivateLink ? salt : undefined,
            mode: currentViewMode,
            isPrivate: settings.isPrivateLink,
            accessType: settings.accessLevel,
            previewOnly:
              documentType === 'markdown'
                ? settings.previewOnly === true
                : false,
            type: documentType,
            ...(ownerKeyWrapped ? { ownerKeyWrapped } : {}),
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Share failed')
        }

        setIsLegacyDocument(false)
        setShowMigrationBanner(false)

        const newSlug = data.slug || documentSlug
        if (newSlug) {
          setDocumentSlug(newSlug)
          addOwnership(newSlug)

          const route = `${getEditorBasePath(documentType)}/`
          const viewParam =
            documentType === 'text' ||
            documentType === 'markdown' ||
            documentType === 'html'
              ? ''
              : `?view=${currentViewMode}`
          const fragment = settings.isPrivateLink
            ? ''
            : `#key=${keyString || activeKeyStringRef.current || ''}`
          const newUrl = `${route}${newSlug}${viewParam}${fragment}`

          window.history.pushState(
            { ...window.history.state, as: newUrl, url: newUrl },
            '',
            newUrl
          )
        }

        setUserAccessLevel(settings.accessLevel)
        setIsDocumentPrivate(settings.isPrivateLink)
        setIsPreviewOnly(
          documentType === 'markdown' ? settings.previewOnly === true : false
        )
        if (settings.isPrivateLink) setIsPrivacyLocked(true)
        if (settings.sharePassword) setDocumentPassword(settings.sharePassword)
        if (ownerKeyWrapped) setHasOwnerKeyWrapped(true)
        if (data.ownerId) setDocumentOwnerId(data.ownerId)

        const route = `${getEditorBasePath(documentType)}/`
        const fragment = settings.isPrivateLink
          ? ''
          : `#key=${keyString || activeKeyStringRef.current || ''}`
        const link = `${window.location.origin}${route}${newSlug}${fragment}`

        let message = copyToClipboard
          ? 'Settings saved and encrypted link copied to clipboard!'
          : 'Share settings saved.'
        if (copyToClipboard) {
          try {
            await navigator.clipboard.writeText(link)
          } catch (err) {
            console.warn('Clipboard write failed', err)
            message = 'Settings saved. Copy your link below!'
          }
        }

        setIsShareModalOpen(true)
        setToastState({ isOpen: true, message })
        return link
      } catch (e) {
        console.error(e)
        triggerAlert('Share Failed', (e as Error).message, 'error')
        throw e
      } finally {
        setIsAutoSaving(false)
      }
    },
    [
      documentSlug,
      documentType,
      currentViewMode,
      currentJsonContent,
      getToken,
      getOrCreateDocumentKey,
      addOwnership,
    ]
  )


  const openAuthModal = useCallback(
    (options?: {
      pendingSettings?: {
        accessLevel: ShareAccessType
        isPrivateLink: boolean
        sharePassword?: string
        previewOnly?: boolean
      }
      pendingOpenModal?: boolean
    }) => {
      const currentUrl =
        typeof window !== 'undefined' ? window.location.href : '/editor'

      if (options?.pendingSettings) {
        pendingShareSettingsRef.current = options.pendingSettings
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              'jsonrock_pending_share_settings',
              JSON.stringify(options.pendingSettings)
            )
          } catch (e) {
            console.warn('SessionStorage write failed', e)
          }
        }
      }

      if (options?.pendingOpenModal) {
        pendingOpenShareModalRef.current = true
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('jsonrock_pending_open_share_modal', 'true')
          } catch (e) {
            console.warn('SessionStorage write failed', e)
          }
        }
      }

      try {
        openSignIn({
          fallbackRedirectUrl: currentUrl,
          signUpFallbackRedirectUrl: currentUrl,
          forceRedirectUrl: currentUrl,
          signUpForceRedirectUrl: currentUrl,
        })
      } catch (e) {
        console.warn('Clerk openSignIn modal failed:', e)
      }
    },
    [openSignIn]
  )

  const handleShareDocument = useCallback(
    async (
      settings: {
        accessLevel: ShareAccessType
        isPrivateLink: boolean
        sharePassword?: string
        previewOnly?: boolean
      },
      options?: { copyToClipboard?: boolean }
    ): Promise<string> => {
      if (
        settings.isPrivateLink &&
        (!settings.sharePassword || settings.sharePassword.length < 4)
      ) {
        triggerAlert(
          'Invalid Password',
          'Password must be at least 4 characters.',
          'error'
        )
        throw new Error('Invalid password')
      }

      // If user is not authenticated, preserve share settings and trigger Clerk sign-in modal
      if (!isSignedIn) {
        openAuthModal({ pendingSettings: settings })
        throw new Error('Authentication required')
      }

      pendingShareSettingsRef.current = null
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('jsonrock_pending_share_settings')
          sessionStorage.removeItem('jsonrock_pending_open_share_modal')
        } catch (e) {
          console.warn('SessionStorage remove failed', e)
        }
      }
      return executeShareDocument(settings, options)
    },
    [isSignedIn, openAuthModal, executeShareDocument]
  )

  const handleSendShareEmail = useCallback(
    async (payload: {
      recipientEmail: string
      shareUrl: string
      documentTitle: string
    }) => {
      let token: string | null = null
      try {
        token = await getToken()
      } catch (e) {
        console.warn('Failed to retrieve Clerk auth token', e)
      }
      if (!token) {
        throw new Error('Authentication required to send email.')
      }

      const res = await fetch('/api/share/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email')
      }
      return data as { message?: string }
    },
    [getToken]
  )

  const handleOpenShareModal = useCallback(
    (open: boolean) => {
      if (open && !isSignedIn) {
        openAuthModal({ pendingOpenModal: true })
        return
      }
      setIsShareModalOpen(open)
    },
    [isSignedIn, openAuthModal]
  )

  // Automatically resume the share operation or open modal once sign-in/sign-up completes
  useEffect(() => {
    if (isSignedIn) {
      let pendingSettings = pendingShareSettingsRef.current
      let pendingOpenModal = pendingOpenShareModalRef.current

      // Retrieve from sessionStorage if state was lost during OAuth or sign-up redirect
      if (typeof window !== 'undefined') {
        try {
          if (!pendingSettings) {
            const stored = sessionStorage.getItem(
              'jsonrock_pending_share_settings'
            )
            if (stored) {
              pendingSettings = JSON.parse(stored)
            }
          }
        } catch (e) {
          console.warn(
            'Failed to parse pending share settings from sessionStorage',
            e
          )
        }

        try {
          if (!pendingOpenModal) {
            const storedModal = sessionStorage.getItem(
              'jsonrock_pending_open_share_modal'
            )
            if (storedModal === 'true') {
              pendingOpenModal = true
            }
          }
        } catch (e) {
          console.warn(
            'Failed to parse pending open share modal from sessionStorage',
            e
          )
        }
      }

      if (pendingSettings) {
        pendingShareSettingsRef.current = null
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('jsonrock_pending_share_settings')
            sessionStorage.removeItem('jsonrock_pending_open_share_modal')
          } catch (e) {
            console.warn('SessionStorage cleanup failed', e)
          }
        }
        executeShareDocument(pendingSettings)
      } else if (pendingOpenModal) {
        pendingOpenShareModalRef.current = false
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('jsonrock_pending_open_share_modal')
            sessionStorage.removeItem('jsonrock_pending_share_settings')
          } catch (e) {
            console.warn('SessionStorage cleanup failed', e)
          }
        }
        setIsShareModalOpen(true)
      }
    }
  }, [isSignedIn, executeShareDocument])

  // Debounce the input to avoid thrashing the worker
  const debouncedJsonContent = useDebounce(currentJsonContent, 500)

  // Send content to Web Worker for processing
  useEffect(() => {
    if (!debouncedJsonContent || !debouncedJsonContent.trim()) {
      resetWorker()
      setIsJsonValid(true)
      setGraphNodes([])
      setGraphEdges([])
      setTreeNodes([])
      setParsedJsonData(null)
      setJsonValidationError(null)
      setIsGraphTooLarge(false)
      return
    }

    if (
      documentType === 'text' ||
      documentType === 'markdown' ||
      documentType === 'html'
    ) {
      setIsJsonValid(true)
      setJsonValidationError(null)
      return
    }

    try {
      const parsed = JSON.parse(debouncedJsonContent)
      setParsedJsonData(parsed)
      setIsJsonValid(true)
      setJsonValidationError(null)
      processJson(debouncedJsonContent)
    } catch (e) {
      setIsJsonValid(false)
      if (e instanceof SyntaxError) {
        setJsonValidationError(getJsonParseError(debouncedJsonContent, e))
      }
    }
  }, [debouncedJsonContent, documentType, processJson, resetWorker])

  // Listen to Worker Results and run ELK layout
  useEffect(() => {
    if (workerState.status === 'error') {
      setIsJsonValid(false)
    } else if (workerState.status === 'ready') {
      const {
        rfNodes,
        rfEdges,
        elkNodes,
        elkEdges,
        treeNodes: newTreeNodes,
        layoutOptions,
      } = workerState.result

      setTreeNodes(newTreeNodes)

      if (rfNodes.length > 1000) {
        setIsGraphTooLarge(true)
        setGraphNodes([])
        setGraphEdges([])
        setIsLayoutCalculating(false)
      } else {
        setIsGraphTooLarge(false)
        if (currentViewMode === 'visualize') {
          setIsLayoutCalculating(true)
          applyElkLayout(
            rfNodes,
            rfEdges,
            elkNodes,
            elkEdges,
            layoutOptions
          ).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
            setGraphNodes(layoutedNodes)
            setGraphEdges(layoutedEdges)
            setIsLayoutCalculating(false)
          })
        } else {
          setGraphNodes([])
          setGraphEdges([])
        }
      }
    }
  }, [workerState, currentViewMode])

  const handleEditorValidation = useCallback((markers: any[]) => {
    const issues = markers.filter((m) => m.severity >= 4)
    if (issues.length > 0) {
      const highestIssue = issues.sort((a, b) => b.severity - a.severity)[0]
      setMonacoValidationError({
        message: highestIssue.message,
        line: highestIssue.startLineNumber,
        severity: highestIssue.severity >= 8 ? 'error' : 'warning',
      })
    } else {
      setMonacoValidationError(null)
    }
  }, [])

  // Debounce for Auto-Save (2 seconds)
  const debouncedContentForAutoSave = useDebounce(currentJsonContent, 2000)

  // Auto-Save Effect
  useEffect(() => {
    if (
      (documentType === 'text' ||
        documentType === 'json' ||
        documentType === 'markdown' ||
        documentType === 'html') &&
      documentSlug &&
      hasEditPermission &&
      !isPasswordLocked &&
      (documentType !== 'json' || isJsonValid)
    ) {
      if (debouncedContentForAutoSave === lastPersistedContentRef.current)
        return

      handleSaveDocument(true)
    }
  }, [
    debouncedContentForAutoSave,
    documentType,
    documentSlug,
    hasEditPermission,
    isPasswordLocked,
    isJsonValid,
  ])

  // Auto-Create Effect: When no slug exists and user edits default content, auto-create an encrypted document
  const isAutoCreatingRef = React.useRef(false)
  useEffect(() => {
    if (
      !documentSlug &&
      debouncedContentForAutoSave !== lastPersistedContentRef.current &&
      debouncedContentForAutoSave.trim() &&
      !isAutoCreatingRef.current &&
      (documentType !== 'json' || isJsonValid)
    ) {
      isAutoCreatingRef.current = true
      const targetType = documentType

      ;(async () => {
        try {
          const { key, keyString } = await getOrCreateDocumentKey()
          const { ciphertext, iv } = await encryptContent(
            debouncedContentForAutoSave,
            key
          )
          encryptedPayloadRef.current = { ciphertext, iv }

          const res = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ciphertext,
              iv,
              mode: currentViewMode,
              type: targetType,
              accessType: 'editor',
              isPrivate: false,
            }),
          })
          const data = await res.json()
          if (data.slug) {
            setDocumentSlug(data.slug)
            setUserAccessLevel(data.accessType || 'editor')
            setHasEditPermission(true)
            setIsCurrentUserOwner(true)
            setDocumentType(data.type || targetType)
            addOwnership(data.slug)
            lastPersistedContentRef.current = debouncedContentForAutoSave

            const resolvedType = (data.type || targetType) as ShareType
            const route = `${getEditorBasePath(resolvedType)}/`
            const viewParam =
              resolvedType === 'text' ||
              resolvedType === 'markdown' ||
              resolvedType === 'html'
                ? ''
                : `?view=${currentViewMode}`
            const newUrl = `${route}${data.slug}${viewParam}#key=${keyString}`

            justAutoSavedSlugRef.current = data.slug
            window.history.replaceState(
              { ...window.history.state, as: newUrl, url: newUrl },
              '',
              newUrl
            )

            patchEditorTabSession(resolvedType, {
              slug: data.slug,
              lastPersistedContent: debouncedContentForAutoSave,
              activeKey: activeKeyRef.current,
              activeKeyString: keyString ?? null,
              encryptedPayload: { ciphertext, iv },
              userAccessLevel: data.accessType || 'editor',
              hasEditPermission: true,
              isCurrentUserOwner: true,
            })
          }
        } catch (e) {
          console.error('Auto-create failed', e)
        } finally {
          isAutoCreatingRef.current = false
        }
      })()
    }
  }, [
    debouncedContentForAutoSave,
    documentSlug,
    documentType,
    isJsonValid,
    currentViewMode,
    getOrCreateDocumentKey,
  ])

  const handleCopy = () => {
    // Copy the formatted output, not the input, if we are in format tab
    if (currentViewMode === 'formatter' && formattedOutput) {
      navigator.clipboard.writeText(formattedOutput)
    } else {
      navigator.clipboard.writeText(currentJsonContent)
    }
    setIsClipboardCopied(true)
    setTimeout(() => setIsClipboardCopied(false), 2000)
  }

  const handleDownload = () => {
    try {
      if (!currentJsonContent) return
      const blob = new Blob([currentJsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = documentSlug ? `${documentSlug}.json` : 'data.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download failed', e)
    }
  }

  const formattedOutput = React.useMemo(() => {
    if (!currentJsonContent) return ''
    try {
      // If we already typed valid JSON, format it
      if (documentType === 'json' && isJsonValid) {
        return JSON.stringify(
          JSON.parse(currentJsonContent),
          null,
          Number(indentationSize)
        )
      }
      return currentJsonContent
    } catch {
      return currentJsonContent
    }
  }, [currentJsonContent, indentationSize, documentType, isJsonValid])

  const formatterRemoteValue = React.useMemo(
    () => ({ code: formattedOutput, nonce: 1 }),
    [formattedOutput]
  )

  // Mobile specific view state
  const [mobileTab, setMobileTab] = useState<'editor' | 'viewer'>('editor')

  return (
    <div
      className={cn(
        'flex h-dvh w-screen bg-gray-50 text-zinc-800 font-sans overflow-hidden',
        documentType !== 'text' &&
          'dark:bg-zinc-950 dark:text-zinc-300 relative'
      )}
    >
      {(isPageLoading || isOwnerUnlockPending) && !isPasswordLocked && (
        <div className='absolute inset-0 z-100 flex items-center justify-center pointer-events-none'>
          <JsonRockLoader className='w-14 h-14' />
        </div>
      )}

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col min-w-0'>
        {/* Top Bar */}
        <EditorHeader
          documentType={documentType}
          documentSlug={documentSlug}
          isJsonValid={isJsonValid}
          onOpenUploadModal={setIsUploadModalOpen}
          onCreateNewDocument={handleCreateNewDocument}
          isAutoSaving={isAutoSaving}
          onOpenShareModal={handleOpenShareModal}
          onOpenHistoryModal={openHistoryModal}
          currentViewMode={currentViewMode}
          previewOnlyView={isMarkdownPreviewOnlyShare}
        />

        {/* Legacy Document Migration Notice Banner */}
        {showMigrationBanner && (
          <div className='bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3 shrink-0 z-20'>
            <div className='flex items-center gap-2 min-w-0'>
              <AlertTriangle
                size={15}
                className='shrink-0 text-amber-600 dark:text-amber-400'
              />
              <span className='truncate sm:whitespace-normal'>
                <strong>Upgrade Notice:</strong> This document is stored in
                legacy plaintext. When you edit and save changes, it will be
                automatically upgraded to End-to-End Encryption. Anyone with the
                current link will need the new link (generated upon saving) to
                view this content.
              </span>
            </div>
            <button
              onClick={() => setShowMigrationBanner(false)}
              className='p-1 hover:bg-amber-500/20 rounded transition-colors text-amber-800 dark:text-amber-300 shrink-0'
              title='Dismiss notice'
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Split View */}
        <main className='flex-1 flex flex-col lg:flex-row overflow-hidden relative'>
          {/* Editor Pane (Left/Top) — unmount when collapsed (display:none crashes Monaco) */}
          {!(documentType === 'json' && isLeftEditorCollapsed) && (
            <div
              style={
                {
                  '--left-panel-width': `${editorPanelWidthPercentage}%`,
                } as React.CSSProperties
              }
              className={cn(
                'border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col bg-white h-full min-h-0',
                documentType === 'json' &&
                  'dark:border-zinc-900 dark:bg-[#09090b]',
                documentType !== 'json'
                  ? 'w-full'
                  : 'w-full lg:w-(--left-panel-width) lg:min-w-75',
                mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
              )}
            >
              {documentType === 'text' ? (
                <div className='flex-1 h-full relative'>
                  <RichTextEditor
                    content={currentJsonContent}
                    onChange={onJsonContentChange}
                    readOnly={!hasEditPermission}
                    remoteContent={syncedRemoteContent?.code}
                    forceLightMode={true}
                    isCurrentUserOwner={isCurrentUserOwner}
                    slug={documentSlug}
                  />
                </div>
              ) : documentType === 'markdown' ? (
                <div className='flex-1 h-full relative'>
                  <MarkdownEditor
                    content={currentJsonContent}
                    onChange={onJsonContentChange}
                    readOnly={!hasEditPermission || isMarkdownPreviewOnlyShare}
                    onFileDrop={processSelectedFile}
                    slug={documentSlug}
                    sharePreviewOnly={isMarkdownPreviewOnlyShare}
                  />
                </div>
              ) : documentType === 'html' ? (
                <div className='flex-1 min-h-0 h-full relative overflow-hidden'>
                  <HtmlEditor
                    content={currentJsonContent}
                    onChange={onJsonContentChange}
                    readOnly={!hasEditPermission}
                    slug={documentSlug}
                  />
                </div>
              ) : (
                <div className='flex-1 relative flex flex-col h-full'>
                  <div className='flex-1 relative min-h-0'>
                    <JsonEditor
                      defaultValue={currentJsonContent} // Initial Load Only
                      remoteValue={syncedRemoteContent} // Updates Only
                      onChange={onJsonContentChange}
                      onReady={() => setIsEditorReady(true)}
                      onValidate={handleEditorValidation}
                      readOnly={!hasEditPermission}
                      onFileDrop={processSelectedFile}
                      slug={documentSlug}
                      showSidebarToggle
                      isSidebarCollapsed={isLeftEditorCollapsed}
                      onToggleSidebar={() => setIsLeftEditorCollapsed(true)}
                      options={JSON_EDITOR_INPUT_OPTIONS}
                    />

                    {/* Error / Warning Alert Overlay */}
                    {effectiveValidationError &&
                      (!isDocValid ||
                        effectiveValidationError.severity === 'warning') && (
                        <div className='absolute bottom-4 left-4 right-4 lg:bottom-6 lg:left-8 lg:right-8 z-30 animate-in fade-in slide-in-from-bottom-2'>
                          <div
                            className={cn(
                              'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 lg:p-4 rounded-xl shadow-xl flex items-start gap-3 lg:gap-4 ring-1 ring-black/5 dark:ring-white/5 border',
                              effectiveValidationError.severity === 'warning'
                                ? 'border-amber-400 dark:border-amber-600/50'
                                : 'border-red-200 dark:border-red-900/50'
                            )}
                          >
                            <div
                              className={cn(
                                'p-1.5 lg:p-2 rounded-lg shrink-0 shadow-sm border',
                                effectiveValidationError.severity === 'warning'
                                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-500'
                                  : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-500'
                              )}
                            >
                              <AlertCircle className='w-4 h-4 lg:w-5 lg:h-5' />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <div className='flex items-center justify-between gap-2 lg:gap-4'>
                                <h4
                                  className={cn(
                                    'text-xs lg:text-sm font-bold flex items-center gap-2',
                                    effectiveValidationError.severity ===
                                      'warning'
                                      ? 'text-amber-800 dark:text-amber-400'
                                      : 'text-zinc-900 dark:text-zinc-100'
                                  )}
                                >
                                  {effectiveValidationError.severity ===
                                  'warning'
                                    ? 'Warning'
                                    : 'Invalid JSON'}
                                </h4>
                                {effectiveValidationError.line && (
                                  <span
                                    className={cn(
                                      'text-[10px] font-mono font-bold px-1.5 lg:px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border',
                                      effectiveValidationError.severity ===
                                        'warning'
                                        ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50'
                                        : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900/50'
                                    )}
                                  >
                                    Line {effectiveValidationError.line}
                                  </span>
                                )}
                              </div>
                              <p
                                className={cn(
                                  'text-[11px] lg:text-xs mt-1 lg:mt-1.5 font-mono wrap-break-word leading-relaxed border-l-2 pl-2 lg:pl-3',
                                  effectiveValidationError.severity ===
                                    'warning'
                                    ? 'text-amber-700 dark:text-amber-400/80 border-amber-300 dark:border-amber-700/50'
                                    : 'text-zinc-600 dark:text-zinc-400 border-red-200 dark:border-red-900/50'
                                )}
                              >
                                {effectiveValidationError.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Go to View Button (Mobile Only) */}
                    <div className='lg:hidden absolute top-11 right-2 z-20'>
                      <button
                        onClick={() => setMobileTab('viewer')}
                        className='flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-900/20 font-medium text-xs hover:bg-emerald-500 transition-transform active:scale-95 backdrop-blur-sm opacity-90 hover:opacity-100'
                      >
                        Go to View
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resizer Handle */}
          {documentType === 'json' && !isLeftEditorCollapsed && (
            <div
              className={`hidden lg:flex w-1 bg-transparent cursor-col-resize z-40 items-center justify-center transition-colors`}
              onMouseDown={startResizing}
            >
              {/* Optional Grip Icon or dots */}
            </div>
          )}

          {/* View Pane (Right/Bottom) — only for JSON type; stays visible when left collapses */}
          <div
            style={
              {
                '--right-panel-width': `${100 - editorPanelWidthPercentage}%`,
              } as React.CSSProperties
            }
            className={cn(
              'bg-gray-50 dark:bg-[#050505] relative overflow-hidden h-full',
              documentType !== 'json'
                ? 'hidden'
                : cn(
                    isLeftEditorCollapsed
                      ? 'w-full'
                      : 'w-full lg:w-(--right-panel-width)',
                    // Mobile tab switching
                    mobileTab === 'viewer'
                      ? 'flex flex-col'
                      : 'hidden lg:flex lg:flex-col'
                  )
            )}
          >
            {/* Unified left icon rail — expand + view modes, centered on one axis */}
            <div className='absolute top-3 left-3 z-50 flex w-9 flex-col items-center gap-3'>
              {isLeftEditorCollapsed && (
                <button
                  type='button'
                  onClick={() => setIsLeftEditorCollapsed(false)}
                  title='Expand JSON editor'
                  aria-label='Expand JSON editor'
                  className='hidden lg:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-emerald-600 shadow-lg backdrop-blur-sm hover:bg-emerald-50 hover:border-emerald-300 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-700'
                >
                  <PanelLeftOpen size={16} />
                </button>
              )}

              {/* Formatter View Button */}
              <div className='relative group flex h-9 w-9 shrink-0 items-center justify-center'>
                <button
                  onClick={() => {
                    setCurrentViewMode('formatter')
                    const newUrl = new URL(window.location.href)
                    newUrl.searchParams.set('view', 'formatter')
                    window.history.pushState(
                      {
                        ...window.history.state,
                        as: newUrl.toString(),
                        url: newUrl.toString(),
                      },
                      '',
                      newUrl.toString()
                    )
                  }}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200',
                    currentViewMode === 'formatter'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
                      : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
                  )}
                >
                  <Code2 size={16} />
                </button>
                <div className='absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700'>
                  JSON Formatter
                </div>
              </div>

              {/* Graph View Button */}
              <div className='relative group flex h-9 w-9 shrink-0 items-center justify-center'>
                <button
                  onClick={() => {
                    setCurrentViewMode('visualize')
                    const newUrl = new URL(window.location.href)
                    newUrl.searchParams.set('view', 'visualize')
                    window.history.pushState(
                      {
                        ...window.history.state,
                        as: newUrl.toString(),
                        url: newUrl.toString(),
                      },
                      '',
                      newUrl.toString()
                    )
                  }}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200',
                    currentViewMode === 'visualize'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
                      : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
                  )}
                >
                  <GitGraph size={16} />
                </button>
                <div className='absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700'>
                  Graph View
                </div>
              </div>

              {/* Tree View Button */}
              <div className='relative group flex h-9 w-9 shrink-0 items-center justify-center'>
                <button
                  onClick={() => {
                    setCurrentViewMode('tree')
                    const newUrl = new URL(window.location.href)
                    newUrl.searchParams.set('view', 'tree')
                    window.history.pushState(
                      {
                        ...window.history.state,
                        as: newUrl.toString(),
                        url: newUrl.toString(),
                      },
                      '',
                      newUrl.toString()
                    )
                  }}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200',
                    currentViewMode === 'tree'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
                      : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
                  )}
                >
                  <LayoutTemplate size={16} />
                </button>
                <div className='absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700'>
                  Tree Explorer
                </div>
              </div>
            </div>

            {/* Back to Editor Button (Mobile Only) */}
            <div className='lg:hidden absolute top-2 right-10 z-70'>
              <button
                onClick={() => setMobileTab('editor')}
                className='flex items-center gap-2 px-3 py-1.5 bg-zinc-800 dark:bg-zinc-700 text-white rounded-full shadow-lg font-medium text-xs hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-transform active:scale-95 backdrop-blur-sm opacity-90 hover:opacity-100'
              >
                <Code2 size={14} />
                Back to Editor
              </button>
            </div>
            {/* Output Panel: only render after editor mounted and (if graph mode) layout is computed */}
            {isEditorReady &&
              (isJsonValid && workerState.status !== 'ready' ? (
                <div className='h-full w-full flex flex-col items-center justify-center pl-16 animate-in fade-in zoom-in-95 duration-200'>
                  <div className='mb-4 p-4 rounded-full bg-zinc-200 dark:bg-zinc-800/50'>
                    <Code2 size={48} className='opacity-50 text-zinc-400' />
                  </div>
                  <h3 className='text-lg font-semibold text-zinc-700 dark:text-zinc-200'>
                    Empty JSON
                  </h3>
                  <p className='max-w-xs text-center text-sm text-zinc-500'>
                    Please enter valid JSON data in the editor to visualize it.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className={cn(
                      'h-full w-full relative',
                      currentViewMode !== 'visualize' && 'hidden'
                    )}
                  >
                    {isGraphTooLarge ? (
                      <div className='h-full w-full flex flex-col items-center justify-center animate-in fade-in duration-200'>
                        <div className='mb-4 p-4 rounded-full bg-orange-100 dark:bg-orange-900/30'>
                          <LayoutTemplate
                            size={48}
                            className='text-orange-500 dark:text-orange-400'
                          />
                        </div>
                        <h3 className='text-lg font-semibold text-zinc-700 dark:text-zinc-200'>
                          Graph Too Large
                        </h3>
                        <p className='max-w-md text-center text-sm text-zinc-500 mt-2'>
                          This JSON data contains over 1000 nodes, which may
                          cause performance issues in the Graph View.
                          <br />
                          <br />
                          Please use the <strong>Tree Explorer</strong> or{' '}
                          <strong>JSON Formatter</strong> to view this data.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* GraphView is ALWAYS mounted — never unmounted on JSON change.
                            This preserves React Flow's internal zoom/viewport state and
                            our hasFitOnce ref. Loading state is shown as an overlay instead. */}
                        <GraphView nodes={graphNodes} edges={graphEdges} />

                        {/* Loading overlay — shown while ELK is computing new layout */}
                        {isLayoutCalculating && (
                          <div className='absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm'>
                            <div className='w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300 rounded-full animate-spin' />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={cn(
                      'h-full w-full overflow-hidden pl-16',
                      currentViewMode !== 'tree' && 'hidden'
                    )}
                  >
                    {currentViewMode === 'tree' && parsedJsonData !== null && (
                      <TreeExplorer data={parsedJsonData} />
                    )}
                  </div>

                  <div
                    className={cn(
                      'h-full w-full flex flex-col',
                      currentViewMode !== 'formatter' && 'hidden'
                    )}
                  >
                    <div className='flex items-center justify-between pl-4 pr-4 py-1 bg-linear-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-11 shrink-0 ml-16'>
                      <div className='flex items-center gap-2'>
                        <span className='text-sm font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap'>
                          JSON Formatter
                        </span>
                        <select
                          value={indentationSize}
                          onChange={(e) => setIndentationSize(e.target.value)}
                          className='bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-900 dark:text-zinc-300 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500/50 outline-none cursor-pointer'
                        >
                          <option value='2'>2 Tabs</option>
                          <option value='3'>3 Tabs</option>
                          <option value='4'>4 Tabs</option>
                          <option value='minify'>Minify</option>
                        </select>
                      </div>
                      <button
                        onClick={handleCopy}
                        className='p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors group relative'
                      >
                        {isClipboardCopied ? (
                          <Check size={14} className='text-emerald-500' />
                        ) : (
                          <Copy
                            size={14}
                            className='text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-200'
                          />
                        )}
                        <span className='absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity'>
                          Copy Output
                        </span>
                      </button>
                    </div>
                    <div className='flex-1 ml-16'>
                      <JsonEditor
                        defaultValue={formattedOutput}
                        remoteValue={formatterRemoteValue}
                        onChange={() => {}}
                        readOnly={true}
                        className='rounded-none border-0 shadow-none'
                      />
                    </div>
                  </div>
                </>
              ))}
          </div>
        </main>
      </div>
      <ModalAlert
        isOpen={alertState.isOpen}
        onClose={dismissAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        forceLightMode={documentType === 'text'}
      />

      <Toast
        isOpen={toastState.isOpen}
        message={toastState.message}
        onClose={() => setToastState((prev) => ({ ...prev, isOpen: false }))}
        forceLightMode={documentType === 'text'}
      />

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in'>
          <div className='bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2'>
                <UploadCloud size={20} className='text-emerald-500' />
                Upload Document
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className='text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors'
              >
                <X size={20} />
              </button>
            </div>

            <div className='space-y-4'>
              <div
                className={cn(
                  'p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-colors cursor-pointer',
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <UploadCloud size={32} className='text-zinc-400 mb-2' />
                <p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                  {documentType === 'markdown'
                    ? 'Drag and drop or click to select'
                    : 'Click to select file'}
                </p>
                <p className='text-xs text-zinc-500 mt-1'>
                  {documentType === 'markdown'
                    ? '.md supported'
                    : documentType === 'json'
                      ? '.json supported'
                      : '.json, .md, .txt supported'}
                </p>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept={
                    documentType === 'markdown'
                      ? '.md,.mdx,text/markdown'
                      : documentType === 'json'
                        ? 'application/json,.json'
                        : 'application/json,.json,.md,.txt,text/plain'
                  }
                  className='hidden'
                  onChange={handleUploadFile}
                />
              </div>

              {isFileUploading && (
                <div className='flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-500 animate-pulse'>
                  <span>Uploading and processing...</span>
                </div>
              )}

              <div className='flex justify-end gap-2 pt-2'>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className='px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors'
                  disabled={isFileUploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decryption Error Modal */}
      {decryptionError && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4',
            documentType === 'text'
              ? 'bg-white/80'
              : 'bg-white/80 dark:bg-black/80'
          )}
        >
          <div
            className={cn(
              'w-full max-w-md space-y-4 rounded-xl border p-6 shadow-2xl animate-in zoom-in-95',
              documentType === 'text'
                ? 'bg-white border-red-200'
                : 'bg-white dark:bg-zinc-950 border-red-200 dark:border-red-900/40'
            )}
          >
            <div className='flex flex-col items-center gap-2 text-center'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-500'>
                <Lock size={20} />
              </div>
              <h2
                className={cn(
                  'text-lg font-semibold',
                  documentType === 'text'
                    ? 'text-zinc-900'
                    : 'text-zinc-900 dark:text-zinc-100'
                )}
              >
                Decryption Failed
              </h2>
              <p
                className={cn(
                  'text-sm leading-relaxed',
                  documentType === 'text'
                    ? 'text-zinc-600'
                    : 'text-zinc-600 dark:text-zinc-400'
                )}
              >
                {decryptionError}
              </p>
            </div>

            <div className='pt-2 flex flex-col gap-2'>
              <button
                onClick={() => router.push('/editor')}
                className='w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors'
              >
                Create New Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal — wait for owner-unlock check so owners never see a flash */}
      {isPasswordLocked && !isOwnerUnlockPending && !decryptionError && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4',
            documentType === 'text'
              ? 'bg-white/80'
              : 'bg-white/80 dark:bg-black/80'
          )}
        >
          <div
            className={cn(
              'w-full max-w-md space-y-4 rounded-xl border p-6 shadow-2xl',
              documentType === 'text'
                ? 'bg-white border-zinc-200'
                : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
            )}
          >
            <div className='flex flex-col items-center gap-2 text-center'>
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full border',
                  documentType === 'text'
                    ? 'bg-zinc-100 border-zinc-200 text-zinc-500'
                    : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                )}
              >
                <Lock size={20} />
              </div>
              <h2
                className={cn(
                  'text-lg font-semibold',
                  documentType === 'text'
                    ? 'text-zinc-900'
                    : 'text-zinc-900 dark:text-zinc-100'
                )}
              >
                Password Required
              </h2>
              <p
                className={cn(
                  'text-sm',
                  documentType === 'text'
                    ? 'text-zinc-500'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                This shared link is password protected. Please enter the
                password to view.
              </p>
            </div>

            <div className='space-y-4'>
              <div className='relative'>
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  placeholder='Enter password'
                  value={documentPassword}
                  onChange={(e) => setDocumentPassword(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 pr-10',
                    documentType === 'text'
                      ? 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500'
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUnlockDocument()
                  }}
                />
                <button
                  type='button'
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 transition-colors',
                    documentType !== 'text' &&
                      'dark:text-zinc-400 dark:hover:text-zinc-200'
                  )}
                >
                  {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {unlockErrorMessage && (
                <div className='text-red-400 text-xs text-center border border-red-500/20 bg-red-500/10 p-2 rounded'>
                  {unlockErrorMessage}
                </div>
              )}

              <div className='flex items-center gap-3'>
                <button
                  onClick={cancelUnlockAttempt}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    documentType === 'text'
                      ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlockDocument}
                  disabled={isUnlocking || !documentPassword}
                  className='flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                >
                  {isUnlocking ? 'Verifying...' : 'Unlock'}
                  {!isUnlocking && <ArrowRight size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LocalHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        documents={localDocuments}
        activeSlug={documentSlug}
        isLoading={isHistoryLoading}
        onOpenDocument={handleOpenLocalDocument}
        onDeleteDocument={handleDeleteLocalDocument}
        onClearAll={handleClearLocalDocuments}
        onRenameDocument={handleRenameLocalDocument}
        forceLightMode={documentType === 'text'}
      />

      <SharePopover
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        defaultAccessLevel={userAccessLevel}
        defaultIsPrivate={isDocumentPrivate}
        defaultPassword={documentPassword}
        defaultPreviewOnly={isPreviewOnly}
        documentType={documentType}
        documentTitle={deriveDocumentTitle(
          currentJsonContent,
          documentType === 'text' ||
            documentType === 'markdown' ||
            documentType === 'html' ||
            documentType === 'json'
            ? documentType
            : 'json'
        )}
        hasPermissionToConfigure={isCurrentUserOwner}
        isPrivacyLocked={isPrivacyLocked}
        onSaveShareSettings={handleShareDocument}
        onSendShareEmail={handleSendShareEmail}
        isSavingSettings={isAutoSaving}
        shareUrl={
          typeof window !== 'undefined' && documentSlug
            ? `${window.location.origin}${getEditorBasePath(documentType)}/${documentSlug}${
                isDocumentPrivate
                  ? ''
                  : `#key=${activeKeyStringRef.current || (typeof window !== 'undefined' ? extractKeyFromFragment() || '' : '')}`
              }`
            : ''
        }
        forceLightMode={documentType === 'text'}
      />
    </div>
  )
}
