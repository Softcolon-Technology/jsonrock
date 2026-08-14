'use client'

import React, { useCallback, useEffect, useState } from 'react'
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
  UploadCloud,
  X,
  Loader2,
  Eye,
  EyeOff,
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
  getLocalDocumentBySlug,
  listLocalDocuments,
  LocalDocumentRecord,
  saveLocalDocument,
} from '@/lib/local-docs'

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

export type JsonShareMode = 'visualize' | 'tree' | 'formatter'

export type ShareAccessType = 'editor' | 'viewer'

export interface ShareLinkRecord {
  _id?: string
  slug: string
  type: ShareType
  json: string // Content (json or text)
  mode: JsonShareMode
  isPrivate: boolean
  accessType?: ShareAccessType // Defaults to 'viewer' if undefined for old records
  passwordHash?: string
  createdAt: Date
  updatedAt: Date
}

type SerializedShareLinkRecord = Omit<ShareLinkRecord, 'createdAt' | '_id'> & {
  createdAt: string
  _id?: string
  accessType?: ShareAccessType
  type?: ShareType
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

  const [currentJsonContent, setCurrentJsonContent] = useState<string>(
    initialRecord
      ? initialRecord.json
      : effectiveFeatureMode === 'text'
        ? ''
        : effectiveFeatureMode === 'markdown'
          ? '# Hello Markdown\n\nStart typing...'
          : effectiveFeatureMode === 'html'
            ? DEFAULT_HTML_CONTENT
            : '{\n  "project": "JSON ROCK",\n  "visualize": true,\n  "features": [\n    "Graph View",\n    "Tree View",\n    "Formatter"\n  ],\n  "metrics": {\n    "speed": 100,\n    "usability": "high"\n  }\n}'
  )

  const lastPersistedContentRef = React.useRef<string>(
    initialRecord?.json || currentJsonContent
  )

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
  >(effectiveViewMode)

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
  } | null>(null)

  const [indentationSize, setIndentationSize] = useState<string>('2')

  // Loading State
  const [isPageLoading, setIsPageLoading] = useState(
    !!urlSlug && initialRecord?.slug !== urlSlug
  )

  // Share State
  const [documentSlug, setDocumentSlug] = useState<string | null>(
    initialRecord?.slug || null
  )
  const [isDocumentPrivate, setIsDocumentPrivate] = useState(
    initialRecord?.isPrivate || false
  )
  const [userAccessLevel, setUserAccessLevel] = useState<ShareAccessType>(
    initialRecord?.accessType || 'viewer'
  )

  const [isCurrentUserOwner, setIsCurrentUserOwner] = useState(false)

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
    if (!initialRecord?.slug) return true // New document - always editable
    const isOwned = checkOwnership(initialRecord.slug)
    if (isOwned) return true // Owner always can edit
    return initialRecord.accessType === 'editor' // Non-owner: check accessType
  })

  // Check ownership on load & Sync state when initialRecord changes (e.g. on navigation)
  // Check ownership on load & Sync state when initialRecord changes (e.g. on navigation)
  // Sync state when URL slug changes (Navigation / Refresh)

  const syncFromData = useCallback(
    (data: any) => {
      let content = ''
      // Handle new API structure { data: ..., type: ... }
      if (data.type === 'json' && typeof data.data === 'object') {
        content = JSON.stringify(data.data, null, 2)
      } else {
        // Fallback or Text mode
        content = data.data || data.json || ''
      }

      setCurrentJsonContent(content)
      setDocumentSlug(data.slug || null)
      setIsDocumentPrivate(data.isPrivate || false)
      setUserAccessLevel(data.accessType || 'viewer')
      setDocumentType(data.type || 'json')
      // URL param (?view=) takes priority over DB stored mode — it's the explicit user intent
      setCurrentViewMode(paramView || data.mode || 'visualize')
      setSyncedRemoteContent({ code: content, nonce: Date.now() })

      // Handle Locking
      if (data.isPrivate) {
        setIsPrivacyLocked(true)
        // If content is missing/masked, it is locked.
        const isLockedState = data.data === null || data.data === undefined
        setIsPasswordLocked(isLockedState)
      } else {
        setIsPasswordLocked(false)
        setIsPrivacyLocked(false)
      }

      // CRITICAL: Update lastSavedContent to current loaded content
      lastPersistedContentRef.current = content

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
    },
    [checkOwnership]
  )

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

  // Track whether this is the first mount — SSR already provided initialRecord, no need to re-fetch
  const isInitialMountRef = React.useRef(!!initialRecord)

  // Ref to prevent initial fetch when we JUST created the slug via auto-save
  const justAutoSavedSlugRef = React.useRef<string | null>(null)

  // Sync state when URL slug changes (Navigation / Refresh)
  useEffect(() => {
    if (urlSlug) {
      // If we just generated this slug from typing locally, do NOT fetch from DB.
      // This prevents a race condition where fetching overwrites the user's current unsaved keystrokes.
      if (justAutoSavedSlugRef.current === urlSlug) {
        justAutoSavedSlugRef.current = null
        return
      }

      // On the very first mount, SSR already hydrated state from initialRecord — skip the fetch
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false
        setIsPageLoading(false)

        // CRITICAL FIX: SSR cannot access cookies, meaning initial renders on a deployed server
        // will incorrectly default to "viewer" status for the owner.
        // We must re-check the cookie immediately on the client side upon hydration.
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
            syncFromData(data)
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
      // NAVIGATED TO ROOT (New File)
      isInitialMountRef.current = false
      const defaultContent =
        featureMode === 'text'
          ? ''
          : featureMode === 'markdown'
            ? '# Hello Markdown\n\nStart typing...'
            : featureMode === 'html'
              ? DEFAULT_HTML_CONTENT
              : '{\n  "project": "JSON ROCK",\n  "visualize": true,\n  "features": [\n    "Graph View",\n    "Tree View",\n    "Formatter"\n  ],\n  "metrics": {\n    "speed": 100,\n    "usability": "high"\n  }\n}'

      // Reset the state to an empty un-saved document canvas
      setCurrentJsonContent(defaultContent)
      setDocumentSlug(null)
      setIsDocumentPrivate(false)
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
      resetWorker()
      setIsPageLoading(false)
    }
  }, [urlSlug, featureMode, syncFromData, syncFromLocalRecord, resetWorker])

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

  const [documentPassword, setDocumentPassword] = useState('')
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false)
  // Track if the record is indefinitely private (persisted as private)
  const [isPrivacyLocked, setIsPrivacyLocked] = useState(
    initialRecord?.isPrivate || false
  )

  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Locked State for Private Links
  const [isPasswordLocked, setIsPasswordLocked] = useState(
    (initialRecord?.isPrivate && !initialRecord?.json) || false
  )
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockErrorMessage, setUnlockErrorMessage] = useState<string | null>(
    null
  )
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

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

  const emitTimeout = React.useRef<NodeJS.Timeout | null>(null)

  // Stable Change Handler
  const onJsonContentChange = useCallback((newCode: string | undefined) => {
    const code = newCode || ''
    setCurrentJsonContent(code)

    // Debounce socket emission to prevent flooding/lag
    if (emitTimeout.current) clearTimeout(emitTimeout.current)

    emitTimeout.current = setTimeout(() => {
      // Emit change if we have a slug and aren't locked (regardless of validity)
      if (slugRef.current && !isLockedRef.current) {
        const socket = getSocket()
        if (socket && socket.connected) {
          socket.emit('code-change', { slug: slugRef.current, newCode: code })
        }
      }
    }, 100)
  }, []) // ID IS STABLE NOW

  // Socket Effect - OPTIMIZED for Production
  useEffect(() => {
    if (!documentSlug) return

    // Skip socket connection for locked private content (no collaboration possible)
    if (isDocumentPrivate && isPasswordLocked) return

    const socket = getSocket()

    const onConnect = () => {
      socket.emit('join-room', documentSlug)
    }

    const onCodeChange = (newCode: string) => {
      // If we receive an update, we treat it as the source of truth
      setCurrentJsonContent(newCode)
      setSyncedRemoteContent({ code: newCode, nonce: Date.now() })
      // CRITICAL: Mark as saved to prevent duplicate auto-save from this browser
      lastPersistedContentRef.current = newCode
    }

    // CRITICAL FIX: Only connect if not already connected
    // This prevents reconnection churn when slug changes
    if (!socket.connected) {
      socket.connect()
    } else {
      // Already connected, just join the new room
      onConnect()
    }

    socket.on('connect', onConnect)
    socket.on('code-change', onCodeChange)

    // Handle immediate connection case
    if (socket.connected) {
      onConnect()
    }

    return () => {
      // CRITICAL FIX: Only remove OUR listeners, don't disconnect
      // This prevents reconnection churn when component re-renders
      socket.off('connect', onConnect)
      socket.off('code-change', onCodeChange)
      // Leave the room but stay connected for potential reuse
      socket.emit('leave-room', documentSlug)
    }
  }, [documentSlug, isPasswordLocked]) // CRITICAL: Include isLocked so socket connects after unlock

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
    if (!initialRecord?.slug) return
    setIsUnlocking(true)
    setUnlockErrorMessage(null)

    // Capture the password before the async call so it survives any re-renders
    const password = documentPassword

    try {
      const res = await fetch(`/api/share/${initialRecord.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUnlockErrorMessage(data.error || 'Failed to unlock')
        return
      }

      // Success — persist the password so auto-save can re-encrypt
      setDocumentPassword(password)
      syncFromData(data)

      // Check if I am actually the owner (maybe I created it on this device?)
      const ownedSlugs = Cookies.get('json-rock-owned')
      if (ownedSlugs) {
        try {
          const parsed = JSON.parse(ownedSlugs)
          if (Array.isArray(parsed) && parsed.includes(initialRecord.slug)) {
            setIsCurrentUserOwner(true)
            setHasEditPermission(true)
          }
        } catch (e) {}
      }

      setIsPrivacyLocked(data.isPrivate)
      setIsPasswordLocked(false)
    } catch (err) {
      setUnlockErrorMessage((err as Error).message)
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
    setIsDocumentPrivate(false)
    setIsPrivacyLocked(false)
    setUserAccessLevel('viewer') // Default for new link settings
    setHasEditPermission(true) // New file is always editable
    setDocumentPassword('')
    setSyncedRemoteContent({
      code: initialContent,
      nonce: Date.now(),
    })

    // Set view mode to formatter for JSON documents
    if (!isText && !isMarkdown && !isHtml) {
      setCurrentViewMode('formatter')
    }

    // Create initial record
    setIsAutoSaving(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: initialContent,
          mode: isText || isMarkdown || isHtml ? currentViewMode : 'formatter',
          type: targetType,
          accessType: 'editor',
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

        const resolvedType = (data.type || targetType) as ShareType
        const route = `${getEditorBasePath(resolvedType)}/`
        const viewParam =
          resolvedType === 'text' ||
          resolvedType === 'markdown' ||
          resolvedType === 'html'
            ? ''
            : '?view=formatter'
        const newUrl = `${route}${data.slug}${viewParam}`

        // Use pushState to update URL without refresh
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

    if (isDocumentPrivate && documentPassword.length < 4) {
      if (!silent)
        triggerAlert(
          'Invalid Password',
          'Password must be at least 4 characters for private links.',
          'error'
        )
      return
    }

    setIsAutoSaving(true)
    try {
      const res = await fetch(`/api/share/${documentSlug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: currentJsonContent,
          mode: currentViewMode,
          isPrivate: isDocumentPrivate,
          accessType: userAccessLevel, // Preserve current access settings
          password: isDocumentPrivate ? documentPassword : undefined,
          type: documentType,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        if (data.created) {
          addOwnership(documentSlug)
        }
        if (isDocumentPrivate) setIsPrivacyLocked(true)
        lastPersistedContentRef.current = currentJsonContent // Update last saved reference
        if (!silent)
          triggerAlert(
            'Saved Successfully',
            'Your changes have been saved.',
            'success'
          )
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
          'Network error or server unreachable.',
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

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault()
    setIsResizingPanel(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizingPanel(false)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizingPanel) {
        const newWidth = (mouseMoveEvent.clientX / window.innerWidth) * 100
        // Constraint between 20% and 80%
        if (newWidth > 20 && newWidth < 80) {
          setEditorPanelWidthPercentage(newWidth)
        }
      }
    },
    [isResizingPanel]
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
        if (fileInputRef.current) fileInputRef.current.value = '' // Reset input
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
        if (fileInputRef.current) fileInputRef.current.value = '' // Reset input
        setIsUploadModalOpen(false)
        return
      }
    } else {
      // General validation for text or other modes
      if (!isJson && !isMarkdown && !isText) {
        triggerAlert(
          'Upload Failed',
          'Please select a valid .json, .md, or .txt file.',
          'error'
        )
        if (fileInputRef.current) fileInputRef.current.value = '' // Reset input
        setIsUploadModalOpen(false)
        return
      }
    }

    if (file.size > 2 * 1024 * 1024) {
      triggerAlert('Upload Failed', 'File size exceeds the 2MB limit.', 'error')
      if (fileInputRef.current) fileInputRef.current.value = '' // Reset input
      setIsUploadModalOpen(false)
      return
    }

    setIsFileUploading(true)

    // Read the file content locally before uploading (so we can display it without backend returning it)
    const fileContent = await file.text()

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      // Success - Update state locally and change URL in-place
      const targetType = isJson ? 'json' : isMarkdown ? 'markdown' : 'text'
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
      const newUrl = `${routePrefix}${data.slug}${viewQuery}`

      window.history.pushState(
        { ...window.history.state, as: newUrl, url: newUrl },
        '',
        newUrl
      )

      // Update the editor with the locally-read file content (no backend change needed)
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
    // Only allow drag for markdown
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

    // Only allow drop for markdown
    if (documentType !== 'markdown') return

    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processSelectedFile(file)
  }

  const handleShareDocument = async (settings: {
    accessLevel: ShareAccessType
    isPrivateLink: boolean
    sharePassword?: string
  }) => {
    // Validate
    if (
      settings.isPrivateLink &&
      (!settings.sharePassword || settings.sharePassword.length < 4)
    ) {
      triggerAlert(
        'Invalid Password',
        'Password must be at least 4 characters.',
        'error'
      )
      return
    }

    setIsAutoSaving(true)
    // If no slug, create new
    const method = documentSlug ? 'PUT' : 'POST'
    const url = documentSlug ? `/api/share/${documentSlug}` : '/api/share'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: currentJsonContent,
          mode: currentViewMode,
          isPrivate: settings.isPrivateLink,
          accessType: settings.accessLevel,
          password: settings.sharePassword,
          type: documentType,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Share failed')
      }

      // Success
      const newSlug = data.slug || documentSlug
      if (newSlug !== documentSlug) {
        setDocumentSlug(newSlug)
        addOwnership(newSlug) // Mark as owner of new/updated slug

        const route = `${getEditorBasePath(documentType)}/`
        const viewParam =
          documentType === 'text' ||
          documentType === 'markdown' ||
          documentType === 'html'
            ? ''
            : `?view=${currentViewMode}`
        const newUrl = `${route}${newSlug}${viewParam}`

        // Update URL in-place
        window.history.pushState(
          { ...window.history.state, as: newUrl, url: newUrl },
          '',
          newUrl
        )
      }

      // Update local state
      setUserAccessLevel(settings.accessLevel)
      setIsDocumentPrivate(settings.isPrivateLink)
      if (settings.isPrivateLink) setIsPrivacyLocked(true)
      if (settings.sharePassword) setDocumentPassword(settings.sharePassword)

      // Copy Link
      const route = `${getEditorBasePath(documentType)}/`
      const link = `${window.location.origin}${route}${newSlug}`
      let message = 'Settings saved and link copied to clipboard!'
      try {
        await navigator.clipboard.writeText(link)
      } catch (err) {
        console.warn('Clipboard write failed', err)
        message = 'Settings saved. You can copy the link from the address bar.'
      }

      setIsShareModalOpen(false)
      setToastState({ isOpen: true, message })
    } catch (e) {
      console.error(e)
      triggerAlert('Share Failed', (e as Error).message, 'error')
    } finally {
      setIsAutoSaving(false)
    }
  }

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

    // Try a standard JSON.parse just to check validity and catch syntax errors fast,
    // but don't store the result! Only the worker stores the tree.
    try {
      const parsed = JSON.parse(debouncedJsonContent)
      setParsedJsonData(parsed)
      setIsJsonValid(true)
      setJsonValidationError(null)
      // Send to worker for heavy processing
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

      // Tree view data is ready immediately (virtualized, flat list)
      setTreeNodes(newTreeNodes)

      if (rfNodes.length > 1000) {
        setIsGraphTooLarge(true)
        setGraphNodes([])
        setGraphEdges([])
        setIsLayoutCalculating(false)
      } else {
        setIsGraphTooLarge(false)
        // Graph view needs ELK layout run on the un-positioned nodes
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
          // If we're not in graph mode, we don't strictly need to run ELK,
          // but we can save the unpositioned nodes just in case they switch back.
          // Running it lazy on switch requires keeping the worker result in state,
          // so for now we'll just let the switch re-trigger the worker if needed.
          setGraphNodes([])
          setGraphEdges([])
        }
      }
    }
  }, [workerState, currentViewMode])

  const handleEditorValidation = useCallback((markers: any[]) => {
    // Monaco MarkerSeverity: 8 = Error, 4 = Warning
    const issues = markers.filter((m) => m.severity >= 4)
    if (issues.length > 0) {
      // Sort so errors (8) come before warnings (4)
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
    // Auto-save in Text or JSON Mode, if editable, and has slug
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
      // Check if content actually changed from last save
      if (debouncedContentForAutoSave === lastPersistedContentRef.current)
        return

      // Prevent double calls or saving while already saving (though guard handles it)
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

  // Auto-Create Effect: When no slug exists and user edits default content, auto-create a document
  const isAutoCreatingRef = React.useRef(false)
  useEffect(() => {
    // Only trigger if: no slug, content differs from default, not empty, not already creating
    if (
      !documentSlug &&
      debouncedContentForAutoSave !== lastPersistedContentRef.current &&
      debouncedContentForAutoSave.trim() &&
      !isAutoCreatingRef.current &&
      (documentType !== 'json' || isJsonValid)
    ) {
      isAutoCreatingRef.current = true
      const targetType = documentType
      const isText = targetType === 'text'
      fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: debouncedContentForAutoSave,
          mode: currentViewMode, // Save the actual current view mode, not forced "formatter"
          type: targetType,
          accessType: 'editor',
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.slug) {
            setDocumentSlug(data.slug)
            setUserAccessLevel(data.accessType || 'editor')
            setHasEditPermission(true)
            setIsCurrentUserOwner(true)
            setDocumentType(data.type || targetType)
            addOwnership(data.slug)
            lastPersistedContentRef.current = debouncedContentForAutoSave

            const resolvedType = (data.type || documentType) as ShareType
            const route = `${getEditorBasePath(resolvedType)}/`
            const viewParam =
              resolvedType === 'text' ||
              resolvedType === 'markdown' ||
              resolvedType === 'html'
                ? ''
                : `?view=${currentViewMode}`
            const newUrl = `${route}${data.slug}${viewParam}`

            // Use window.history.replaceState instead of router.replace
            // router.replace causes a Next.js server-side navigation which may 404 because the DB isn't updated instantly causing a redirect to /editor
            justAutoSavedSlugRef.current = data.slug
            window.history.replaceState(
              { ...window.history.state, as: newUrl, url: newUrl },
              '',
              newUrl
            )
          }
        })
        .catch((e) => console.error('Auto-create failed', e))
        .finally(() => {
          isAutoCreatingRef.current = false
        })
    }
  }, [debouncedContentForAutoSave, documentSlug, documentType, isJsonValid])

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
      {isPageLoading && !isPasswordLocked && (
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
          onOpenShareModal={setIsShareModalOpen}
          onOpenHistoryModal={openHistoryModal}
          currentViewMode={currentViewMode}
        />

        {/* Split View */}
        <main className='flex-1 flex flex-col lg:flex-row overflow-hidden relative'>
          {/* Editor Pane (Left/Top) */}
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
              // Mobile visibility toggle
              // Mobile visibility toggle
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
                  readOnly={!hasEditPermission}
                  onFileDrop={processSelectedFile}
                  slug={documentSlug}
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
                <div className='flex-1 relative'>
                  <JsonEditor
                    className='pt-14 lg:pt-0'
                    defaultValue={currentJsonContent} // Initial Load Only
                    remoteValue={syncedRemoteContent} // Updates Only
                    onChange={onJsonContentChange}
                    onReady={() => setIsEditorReady(true)}
                    onValidate={handleEditorValidation}
                    readOnly={!hasEditPermission}
                    onFileDrop={processSelectedFile}
                    slug={documentSlug}
                    options={{
                      padding: { top: 16, bottom: 100 }, // Ensure last lines are visible above floating alert
                    }}
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
                                {effectiveValidationError.severity === 'warning'
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
                                effectiveValidationError.severity === 'warning'
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
                  <div className='lg:hidden absolute top-2 right-14 z-20'>
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

          {/* Resizer Handle */}
          {documentType === 'json' && (
            <div
              className={`hidden lg:flex w-1 bg-transparent cursor-col-resize z-40 items-center justify-center transition-colors`}
              onMouseDown={startResizing}
            >
              {/* Optional Grip Icon or dots */}
            </div>
          )}

          {/* View Pane (Right/Bottom) — only for JSON type */}
          <div
            style={
              {
                '--right-panel-width': `${100 - editorPanelWidthPercentage}%`,
              } as React.CSSProperties
            }
            className={cn(
              'bg-gray-50 dark:bg-[#050505] relative overflow-hidden h-full',
              'w-full lg:w-(--right-panel-width)',
              // Mobile visibility toggle
              mobileTab === 'viewer'
                ? 'flex flex-col'
                : documentType !== 'json'
                  ? 'hidden'
                  : 'hidden lg:flex lg:flex-col'
            )}
          >
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

            {/* Navigation: Sidebar for Graph/Formatter/Tree */}
            <div className='absolute top-4 left-4 z-50 flex flex-col gap-3'>
              {/* Formatter View Button */}
              <div className='relative group'>
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
                    'p-2 rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200',
                    currentViewMode === 'formatter'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20 scale-105'
                      : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 hover:scale-105'
                  )}
                >
                  <Code2 size={18} />
                </button>
                <div className='absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700'>
                  JSON Formatter
                </div>
              </div>

              {/* Graph View Button */}
              <div className='relative group'>
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
                    'p-2 rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200',
                    currentViewMode === 'visualize'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20 scale-105'
                      : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 hover:scale-105'
                  )}
                >
                  <GitGraph size={18} />
                </button>
                {/* Tooltip */}
                <div className='absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700'>
                  Graph View
                </div>
              </div>

              {/* Tree View Button */}
              <div className='relative group'>
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
                    'p-2 rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200',
                    currentViewMode === 'tree'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20 scale-105'
                      : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 hover:scale-105'
                  )}
                >
                  <LayoutTemplate size={18} />
                </button>
                <div className='absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700'>
                  Tree Explorer
                </div>
              </div>
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
                        remoteValue={{ code: formattedOutput, nonce: 0 }}
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

      {/* Unlock Modal */}
      {isPasswordLocked && (
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
        forceLightMode={documentType === 'text'}
      />

      <SharePopover
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        defaultAccessLevel={userAccessLevel}
        defaultIsPrivate={isDocumentPrivate}
        defaultPassword={documentPassword}
        hasPermissionToConfigure={isCurrentUserOwner}
        isPrivacyLocked={isPrivacyLocked}
        onSaveShareSettings={handleShareDocument}
        isSavingSettings={isAutoSaving}
        forceLightMode={documentType === 'text'}
      />
    </div>
  )
}
