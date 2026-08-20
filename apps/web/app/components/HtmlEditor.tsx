'use client'

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import DOMPurify from 'dompurify'
import { createPortal } from 'react-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { beautifyHtmlSource } from '@/lib/beautify-html'
import {
  AlertTriangle,
  Code2,
  Columns2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  Maximize2,
  Minimize2,
  Monitor,
  Printer,
  RefreshCw,
  Shield,
  ShieldOff,
  Smartphone,
  Tablet,
  Terminal,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { ConfirmDialog } from './ui/ConfirmDialog'

function useMinWidth(minPx: number) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minPx}px)`)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [minPx])
  return matches
}

const DRAFT_KEY = 'jsonrock-html-draft'
const PREVIEW_MSG_SOURCE = 'jsonrock-html-preview'

type OsKind = 'mac' | 'windows' | 'linux' | 'unknown'

function detectOs(): OsKind {
  if (typeof navigator === 'undefined') return 'unknown'
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const platform = nav.userAgentData?.platform || navigator.platform || ''
  const ua = navigator.userAgent || ''

  if (
    /mac|iphone|ipad|ipod/i.test(platform) ||
    /Mac OS|iPhone|iPad|Macintosh/i.test(ua)
  ) {
    return 'mac'
  }
  if (/win/i.test(platform) || /Windows/i.test(ua)) return 'windows'
  if (/linux|cros|android/i.test(platform) || /Linux|CrOS|Android/i.test(ua)) {
    return 'linux'
  }
  return 'unknown'
}

/** Mod key label for the current OS (⌘ on Mac, Ctrl elsewhere). */
function usePlatformModKey() {
  const [mod, setMod] = useState('Ctrl')
  const [os, setOs] = useState<OsKind>('unknown')
  useEffect(() => {
    const detected = detectOs()
    setOs(detected)
    setMod(detected === 'mac' ? '⌘' : 'Ctrl')
  }, [])
  return { mod, os }
}

function supportsCssZoom(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function')
    return false
  try {
    return CSS.supports('zoom', '1')
  } catch {
    return false
  }
}

/** Viewport-aware tooltip — desktop hover only (no sticky tips on touch). */
function ToolbarTip({
  label,
  shortcut,
  side = 'bottom',
  feedback,
  children,
}: {
  label: string
  shortcut?: string
  side?: 'bottom' | 'top'
  /** Temporary success message (e.g. "Copied!") — replaces label while set */
  feedback?: string | null
  children: React.ReactNode
}) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, ready: false })
  // Match desktop layout breakpoint — skip hover/focus tips on tablet & phone
  const isDesktop = useMinWidth(1024)

  const open = (isDesktop && hoverOpen) || Boolean(feedback)
  const displayLabel = feedback || label
  const isSuccess = Boolean(feedback)
  // Never show keyboard chords on mobile/tablet
  const showShortcut = isDesktop && Boolean(shortcut) && !isSuccess

  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    const tip = tipRef.current
    if (!trigger || !tip) return

    const rect = trigger.getBoundingClientRect()
    const tipRect = tip.getBoundingClientRect()
    const pad = 8
    const gap = 6

    let top =
      side === 'bottom' ? rect.bottom + gap : rect.top - tipRect.height - gap

    let left = rect.left + rect.width / 2 - tipRect.width / 2
    left = Math.max(
      pad,
      Math.min(left, window.innerWidth - tipRect.width - pad)
    )

    if (side === 'bottom' && top + tipRect.height > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - tipRect.height - gap)
    } else if (side === 'top' && top < pad) {
      top = Math.min(
        window.innerHeight - tipRect.height - pad,
        rect.bottom + gap
      )
    }

    top = Math.max(
      pad,
      Math.min(top, window.innerHeight - tipRect.height - pad)
    )

    setCoords({ top, left, ready: true })
  }, [side])

  useLayoutEffect(() => {
    if (!open) {
      setCoords((c) => ({ ...c, ready: false }))
      return
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, displayLabel, shortcut, isSuccess, showShortcut, reposition])

  // Drop sticky hover when leaving desktop widths (e.g. resize / rotate)
  useEffect(() => {
    if (!isDesktop) setHoverOpen(false)
  }, [isDesktop])

  const show = () => {
    if (!isDesktop) return
    setHoverOpen(true)
  }
  const hide = () => setHoverOpen(false)

  return (
    <div
      ref={triggerRef}
      className='relative inline-flex'
      onMouseEnter={isDesktop ? show : undefined}
      onMouseLeave={isDesktop ? hide : undefined}
      onFocusCapture={isDesktop ? show : undefined}
      onBlurCapture={
        isDesktop
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) hide()
            }
          : undefined
      }
    >
      {children}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            role='tooltip'
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 300,
              opacity: coords.ready ? 1 : 0,
            }}
            className={cn(
              'pointer-events-none flex items-center gap-1.5 rounded-md border px-2 py-1',
              'text-[11px] font-medium shadow-lg whitespace-nowrap',
              isSuccess
                ? 'border-emerald-600/60 bg-emerald-950 text-emerald-300'
                : 'border-zinc-700 bg-zinc-900 text-zinc-100'
            )}
          >
            <span>{displayLabel}</span>
            {showShortcut ? (
              <kbd className='rounded border border-zinc-600 bg-zinc-800 px-1 py-0.5 text-[10px] font-semibold text-zinc-300'>
                {shortcut}
              </kbd>
            ) : null}
          </div>,
          document.body
        )}
    </div>
  )
}

const DEFAULT_HTML = `<!DOCTYPE html>
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

const CDN_PRESETS = [
  {
    id: 'bootstrap',
    label: 'Bootstrap 5',
    snippet: `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"><\/script>`,
  },
  {
    id: 'tailwind',
    label: 'Tailwind CDN',
    snippet: `<script src="https://cdn.tailwindcss.com"><\/script>`,
  },
  {
    id: 'jquery',
    label: 'jQuery',
    snippet: `<script src="https://code.jquery.com/jquery-3.7.1.min.js"><\/script>`,
  },
]

type ViewMode = 'split' | 'source' | 'preview'
type DeviceSize = 'desktop' | 'tablet' | 'mobile'

type ConsoleEntry = {
  id: string
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  at: number
}

interface HtmlEditorProps {
  content: string
  onChange: (value: string) => void
  readOnly?: boolean
  slug?: string | null
}

const DEVICE_WIDTH: Record<DeviceSize, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
}

/**
 * Trusted bridge — injected by the parent, never from user content.
 * Must run before any user scripts so console overrides are in place.
 */
function getConsoleBridgeScript(): string {
  // Escape </script> so HTML parsers don't close the tag early when this is
  // embedded in srcdoc. The JS string still evaluates as "</script>".
  return `<script data-jsonrock-bridge="1">
(function () {
  if (window.__jsonrockBridgeInstalled) return;
  window.__jsonrockBridgeInstalled = true;

  function serialize(value) {
    if (value == null) return String(value);
    if (typeof value === 'string') return value;
    if (value instanceof Error) {
      return value.name + ': ' + value.message + (value.stack ? '\\n' + value.stack : '');
    }
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (e) { return Object.prototype.toString.call(value); }
    }
    return String(value);
  }

  function send(type, payload) {
    try {
      window.parent.postMessage({
        source: '${PREVIEW_MSG_SOURCE}',
        type: type,
        level: payload.level,
        message: payload.message,
        line: payload.line,
        col: payload.col
      }, '*');
    } catch (e) {}
  }

  window.onerror = function (msg, src, line, col, err) {
    send('runtime-error', {
      level: 'error',
      message: err && err.stack ? serialize(err) : String(msg),
      line: line,
      col: col
    });
    return false;
  };

  window.addEventListener('unhandledrejection', function (e) {
    send('runtime-error', {
      level: 'error',
      message: 'Unhandled rejection: ' + serialize(e.reason)
    });
  });

  ['log', 'warn', 'error', 'info', 'debug'].forEach(function (level) {
    var orig = console[level] ? console[level].bind(console) : function () {};
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      send('console', {
        level: level === 'debug' ? 'log' : level,
        message: args.map(serialize).join(' ')
      });
      try { return orig.apply(console, args); } catch (e) {}
    };
  });
})();
<\/script>`
}

function injectConsoleBridge(html: string): string {
  const bridge = getConsoleBridgeScript()
  const trimmed =
    html.trim() || '<!DOCTYPE html><html><head></head><body></body></html>'

  // Install FIRST inside <head> so overrides exist before user <script> tags.
  if (/<head[^>]*>/i.test(trimmed)) {
    return trimmed.replace(/<head[^>]*>/i, (open) => `${open}\n${bridge}\n`)
  }
  if (/<html[^>]*>/i.test(trimmed)) {
    return trimmed.replace(
      /<html[^>]*>/i,
      (open) => `${open}\n<head>\n${bridge}\n</head>\n`
    )
  }
  if (/<body[^>]*>/i.test(trimmed)) {
    return trimmed.replace(/<body[^>]*>/i, (open) => `${bridge}\n${open}`)
  }
  return `${bridge}\n${trimmed}`
}

function sanitizeUserHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['link', 'style', 'meta'],
    ADD_ATTR: ['charset', 'content', 'http-equiv', 'name', 'viewport'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'onkeydown',
      'onkeyup',
      'onkeypress',
      'ondblclick',
      'oninput',
      'onmousedown',
      'onmouseup',
    ],
  })
}

/**
 * Safe Mode: sanitize user HTML (no scripts / handlers). No bridge needed —
 * there is nothing executable to capture.
 * Unsafe Mode: full HTML + trusted console bridge prepended in <head>.
 */
function buildPreviewHtml(source: string, safeMode: boolean): string {
  const raw = source.trim() || '<!DOCTYPE html><html><body></body></html>'
  if (safeMode) return sanitizeUserHtml(raw)
  return injectConsoleBridge(raw)
}

function insertIntoHead(html: string, snippet: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${snippet}\n</head>`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /<html([^>]*)>/i,
      `<html$1>\n<head>\n${snippet}\n</head>`
    )
  }
  return `${snippet}\n${html}`
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/** Strip script/style/comments so JS/CSS `>` / `=>` don't fake tag mismatches. */
function stripNonMarkup(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

function getHtmlLintHints(content: string): string[] {
  const hints: string[] = []
  if (!content.trim()) return hints

  if (!/<!DOCTYPE\s+html/i.test(content)) {
    hints.push('Missing DOCTYPE')
  }

  const markup = stripNonMarkup(content)
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*\/?>/g
  const stack: string[] = []
  let match: RegExpExecArray | null

  while ((match = tagRe.exec(markup)) !== null) {
    const full = match[0]
    const name = match[1]!.toLowerCase()
    const isClose = full.startsWith('</')
    const selfClosing = /\/\s*>$/.test(full) || VOID_TAGS.has(name)

    if (isClose) {
      if (stack.length === 0) {
        hints.push(`Unexpected closing </${name}>`)
        break
      }
      const open = stack.pop()!
      if (open !== name) {
        hints.push(`Mismatched tags: <${open}> closed by </${name}>`)
        break
      }
      continue
    }

    if (!selfClosing) stack.push(name)
  }

  if (hints.length === 0 && stack.length > 0) {
    const shown = stack
      .slice(-3)
      .map((t) => `<${t}>`)
      .join(', ')
    hints.push(
      stack.length === 1
        ? `Unclosed tag: ${shown}`
        : `Unclosed tags: ${shown}${stack.length > 3 ? '…' : ''}`
    )
  }

  return hints
}

const HtmlEditor: React.FC<HtmlEditorProps> = ({
  content,
  onChange,
  readOnly = false,
  slug,
}) => {
  const { resolvedTheme } = useTheme()
  const { mod } = usePlatformModKey()
  /** Side-by-side split (desktop). Below this → stacked source / preview. */
  const isDesktopLayout = useMinWidth(1024)
  /** Phone-sized: tighter chrome, full-width preview, bottom view switcher. */
  const isCompact = !useMinWidth(768)
  const isStackedSplit = !isDesktopLayout
  /** CSS zoom is missing in Firefox — use transform fallback there. */
  const [cssZoomSupported, setCssZoomSupported] = useState(true)
  const [safeMode, setSafeMode] = useState(true)
  const [safeModeDialogOpen, setSafeModeDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [device, setDevice] = useState<DeviceSize>('desktop')
  const [zoom, setZoom] = useState(100)
  const [leftWidth, setLeftWidth] = useState(50)
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [showConsole, setShowConsole] = useState(true)
  const [cdnOpen, setCdnOpen] = useState(false)
  const [customCdn, setCustomCdn] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isConsoleDragging, setIsConsoleDragging] = useState(false)
  const [consoleHeight, setConsoleHeight] = useState(144) // ~h-36
  const [refreshKey, setRefreshKey] = useState(0)
  const [tipFeedback, setTipFeedback] = useState<
    Partial<Record<'copy' | 'download' | 'format' | 'cdn', string>>
  >({})
  const tipTimers = useRef<
    Partial<Record<string, ReturnType<typeof setTimeout>>>
  >({})

  const containerRef = useRef<HTMLDivElement>(null)
  const panesRef = useRef<HTMLDivElement>(null)
  const previewColumnRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const printFrameRef = useRef<HTMLIFrameElement | null>(null)
  const editorRef = useRef<any>(null)
  const cdnMenuRef = useRef<HTMLDivElement>(null)
  const cdnButtonRef = useRef<HTMLButtonElement>(null)
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)
  const dragStartWidth = useRef(50)
  const consoleDragStartY = useRef(0)
  const consoleDragStartHeight = useRef(144)
  /** Full document height inside the iframe — outer pane scrolls this. */
  const [iframeDocHeight, setIframeDocHeight] = useState(600)

  /** Leave enough room for a usable preview when resizing the console. */
  const clampConsoleHeight = useCallback((next: number) => {
    const col = previewColumnRef.current
    const minPreview = 120
    const sep = 12
    const maxFromCol = col
      ? Math.max(80, col.clientHeight - minPreview - sep)
      : Math.floor(window.innerHeight * 0.55)
    return Math.min(maxFromCol, Math.max(80, next))
  }, [])

  const fitIframeToContent = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc?.documentElement) return
    // Collapse first so scrollHeight reflects content, not a stretched iframe box
    iframe.style.height = '0px'
    const next = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0,
      1
    )
    iframe.style.height = `${next}px`
    setIframeDocHeight(next)
  }, [])

  const flashTip = useCallback(
    (key: 'copy' | 'download' | 'format' | 'cdn', message: string) => {
      if (tipTimers.current[key]) clearTimeout(tipTimers.current[key])
      setTipFeedback((prev) => ({ ...prev, [key]: message }))
      tipTimers.current[key] = setTimeout(() => {
        setTipFeedback((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }, 1600)
    },
    []
  )

  useEffect(() => {
    setCssZoomSupported(supportsCssZoom())
  }, [])

  useEffect(() => {
    return () => {
      Object.values(tipTimers.current).forEach((t) => t && clearTimeout(t))
      printFrameRef.current?.remove()
      printFrameRef.current = null
    }
  }, [])

  const debouncedContent = useDebounce(content, 350)

  // refreshKey is intentionally NOT in previewHtml deps — remount via iframe key instead
  const previewHtml = useMemo(
    () => buildPreviewHtml(debouncedContent, safeMode),
    [debouncedContent, safeMode]
  )

  const appendConsoleEntry = useCallback(
    (entry: Omit<ConsoleEntry, 'id' | 'at'>) => {
      setConsoleEntries((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            at: Date.now(),
            ...entry,
          },
          ...prev,
        ].slice(0, 200)
      )
      // Do not force-open the console — user toggle must stay in control
    },
    []
  )

  // Persist draft when no slug yet
  useEffect(() => {
    if (slug || readOnly) return
    try {
      localStorage.setItem(DRAFT_KEY, content)
    } catch {
      /* ignore */
    }
  }, [content, slug, readOnly])

  // Load draft once for new docs with default content
  useEffect(() => {
    if (slug || readOnly) return
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft && (!content || content === DEFAULT_HTML)) {
        onChange(draft)
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Parent message listener — mount once, before/independent of iframe srcdoc updates
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.source !== PREVIEW_MSG_SOURCE) return

      if (data.type === 'console') {
        appendConsoleEntry({
          level: (data.level as ConsoleEntry['level']) || 'log',
          message: String(data.message ?? ''),
        })
        return
      }

      if (data.type === 'runtime-error') {
        appendConsoleEntry({
          level: 'error',
          message:
            data.line != null
              ? `${data.message} (line ${data.line}${data.col != null ? `:${data.col}` : ''})`
              : String(data.message ?? 'Runtime error'),
        })
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [appendConsoleEntry])

  // Only clear console when Safe Mode toggles or user forces refresh — NOT on every keystroke
  const prevSafeModeRef = useRef(safeMode)
  useEffect(() => {
    if (prevSafeModeRef.current !== safeMode) {
      prevSafeModeRef.current = safeMode
      setConsoleEntries([])
    }
  }, [safeMode])

  // CDN menu: click-outside + Escape
  useEffect(() => {
    if (!cdnOpen) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        cdnMenuRef.current?.contains(target) ||
        cdnButtonRef.current?.contains(target)
      ) {
        return
      }
      setCdnOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCdnOpen(false)
        cdnButtonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [cdnOpen])

  const forceRefreshPreview = useCallback(() => {
    setConsoleEntries([])
    setRefreshKey((k) => k + 1)
  }, [])

  const toggleConsole = useCallback(() => {
    setShowConsole((v) => !v)
  }, [])

  const requestDisableSafeMode = useCallback(() => {
    setSafeModeDialogOpen(true)
  }, [])

  const confirmDisableSafeMode = useCallback(() => {
    setSafeMode(false)
    setSafeModeDialogOpen(false)
  }, [])

  const cancelDisableSafeMode = useCallback(() => {
    setSafeModeDialogOpen(false)
  }, [])

  const toggleSafeMode = useCallback(() => {
    if (safeMode) {
      requestDisableSafeMode()
      return
    }
    setSafeMode(true)
  }, [safeMode, requestDisableSafeMode])

  const shortcut = {
    download: `${mod}+S`,
    refresh: `${mod}+Enter`,
    console: `${mod}+\``,
    cdnEscape: 'Esc',
    cdnOpen: '↓',
    cdnAdd: 'Enter',
  }

  // Global shortcuts for console / CDN when focus isn't trapped in Monaco find
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      // Ctrl+` toggles console
      if (meta && (event.key === '`' || event.code === 'Backquote')) {
        event.preventDefault()
        toggleConsole()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleConsole])

  const onEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      downloadHtml()
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      forceRefreshPreview()
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => {
      toggleConsole()
    })
  }

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    dragStartWidth.current = leftWidth
  }

  const onPanePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const el = panesRef.current
    if (!el) return
    if (isStackedSplit) {
      const delta = e.clientY - dragStartY.current
      const pct = (delta / el.clientHeight) * 100
      setLeftWidth(Math.min(80, Math.max(20, dragStartWidth.current + pct)))
      return
    }
    const delta = e.clientX - dragStartX.current
    const pct = (delta / el.clientWidth) * 100
    setLeftWidth(Math.min(80, Math.max(20, dragStartWidth.current + pct)))
  }

  const endPaneResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setIsDragging(false)
  }

  const startConsoleResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsConsoleDragging(true)
    consoleDragStartY.current = e.clientY
    consoleDragStartHeight.current = consoleHeight
  }

  const onConsolePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const delta = consoleDragStartY.current - e.clientY
    setConsoleHeight(clampConsoleHeight(consoleDragStartHeight.current + delta))
  }

  const endConsoleResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setIsConsoleDragging(false)
  }

  useEffect(() => {
    if (!isDragging && !isConsoleDragging) return
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = isConsoleDragging
      ? 'row-resize'
      : isStackedSplit
        ? 'row-resize'
        : 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [isDragging, isConsoleDragging, isStackedSplit])

  const formatHtml = async () => {
    if (readOnly) return
    try {
      const formatted = await beautifyHtmlSource(content, {
        indent_size: 2,
        wrap_line_length: 120,
        end_with_newline: true,
      })
      onChange(formatted)
      flashTip('format', 'Formatted!')
    } catch {
      flashTip('format', 'Format failed')
    }
  }

  const downloadHtml = useCallback(async () => {
    const filename = `preview-${slug || 'draft'}.html`
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'HTML File',
              accept: { 'text/html': ['.html', '.htm'] },
            },
          ],
        })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        flashTip('download', 'Saved!')
        return
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
    }
    const blob = new Blob([content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    flashTip('download', 'Downloaded!')
  }, [content, slug, flashTip])

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(content)
      flashTip('copy', 'Copied!')
    } catch {
      flashTip('copy', 'Copy failed')
    }
  }

  const openInNewTab = () => {
    const blob = new Blob([previewHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  /**
   * Sandboxed preview iframes often block window.print().
   * Print from a temporary frame that allows the print dialog.
   */
  const printPdf = () => {
    if (printFrameRef.current) {
      printFrameRef.current.remove()
      printFrameRef.current = null
    }

    const frame = document.createElement('iframe')
    frame.setAttribute('title', 'Print HTML')
    frame.setAttribute(
      'sandbox',
      'allow-modals allow-same-origin allow-scripts'
    )
    Object.assign(frame.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    })
    document.body.appendChild(frame)
    printFrameRef.current = frame

    const doc = frame.contentDocument
    if (!doc) {
      frame.remove()
      printFrameRef.current = null
      return
    }

    doc.open()
    doc.write(previewHtml)
    doc.close()

    const cleanup = () => {
      window.setTimeout(() => {
        frame.remove()
        if (printFrameRef.current === frame) printFrameRef.current = null
      }, 1500)
    }

    const triggerPrint = () => {
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
      } catch {
        // Popup / print blocked — open content in a tab as fallback
        openInNewTab()
      } finally {
        cleanup()
      }
    }

    // Allow styles/images a beat to settle before the print dialog
    const run = () => window.setTimeout(triggerPrint, 300)
    if (doc.readyState === 'complete') run()
    else frame.onload = () => run()
  }

  const injectCdn = (snippet: string) => {
    if (readOnly || !snippet.trim()) return
    onChange(insertIntoHead(content, snippet.trim()))
    setCdnOpen(false)
    setCustomCdn('')
    flashTip('cdn', 'CDN added!')
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const name = file.name.toLowerCase()
    if (
      !name.endsWith('.html') &&
      !name.endsWith('.htm') &&
      file.type !== 'text/html'
    ) {
      return
    }
    const text = await file.text()
    onChange(text)
  }

  const lintHints = useMemo(() => getHtmlLintHints(content), [content])

  const charCount = content.length
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  const showSource = viewMode === 'split' || viewMode === 'source'
  const showPreview = viewMode === 'split' || viewMode === 'preview'

  // Keep console from eating the whole preview when the window/column shrinks
  useEffect(() => {
    if (!showConsole || !showPreview) return
    const col = previewColumnRef.current
    if (!col || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      setConsoleHeight((h) => clampConsoleHeight(h))
    })
    ro.observe(col)
    return () => ro.disconnect()
  }, [clampConsoleHeight, showConsole, showPreview])

  // Phone: prefer a shorter console so preview stays usable
  useEffect(() => {
    if (!isCompact) return
    setConsoleHeight((h) => Math.min(h, 112))
  }, [isCompact])

  // Re-measure iframe document height after srcdoc updates
  useEffect(() => {
    if (!showPreview) return
    const id = window.setTimeout(() => fitIframeToContent(), 50)
    return () => window.clearTimeout(id)
  }, [showPreview, previewHtml, refreshKey, safeMode, fitIframeToContent])

  const iconBtn =
    'p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed'

  const toolbarBtn = (active: boolean, extra?: string) =>
    cn(
      'p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
      active
        ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
        : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800',
      extra
    )

  return (
    <div
      ref={containerRef}
      className='flex flex-col h-full min-h-0 w-full overflow-hidden bg-white dark:bg-zinc-950'
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={onDrop}
    >
      {/* Toolbar */}
      <div className='shrink-0 flex flex-wrap items-center gap-1 sm:gap-1.5 px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80'>
        {/* Desktop/tablet: icon view modes. Phone uses bottom switcher. */}
        <div
          className={cn(
            'items-center gap-1 mr-1',
            isCompact ? 'hidden' : 'flex'
          )}
          role='group'
          aria-label='View mode'
        >
          {(
            [
              [
                'split',
                Columns2,
                isStackedSplit ? 'Stacked view' : 'Split view',
              ],
              ['source', Code2, 'Source only'],
              ['preview', Eye, 'Preview only'],
            ] as const
          ).map(([mode, Icon, label]) => (
            <ToolbarTip key={mode} label={label}>
              <button
                type='button'
                aria-label={label}
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'p-1.5 rounded-md text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                  viewMode === mode
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                )}
              >
                <Icon size={14} />
              </button>
            </ToolbarTip>
          ))}
        </div>

        <div
          className={cn(
            'h-4 w-px bg-zinc-200 dark:bg-zinc-700',
            isCompact && 'hidden'
          )}
        />

        <ToolbarTip
          label={
            safeMode
              ? 'Safe Mode ON — click to allow scripts'
              : 'Safe Mode OFF — click to sanitize again'
          }
        >
          <button
            type='button'
            aria-label={safeMode ? 'Disable Safe Mode' : 'Enable Safe Mode'}
            aria-pressed={!safeMode}
            onClick={toggleSafeMode}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              safeMode
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            )}
          >
            {safeMode ? <Shield size={12} /> : <ShieldOff size={12} />}
            <span className='hidden sm:inline'>
              {safeMode ? 'Safe' : 'Unsafe'}
            </span>
          </button>
        </ToolbarTip>

        <ToolbarTip
          label='Format / beautify HTML'
          feedback={tipFeedback.format}
        >
          <button
            type='button'
            aria-label='Format HTML'
            disabled={readOnly}
            onClick={formatHtml}
            className={iconBtn}
          >
            <Wand2 size={14} />
          </button>
        </ToolbarTip>

        <ToolbarTip label='Refresh preview' shortcut={shortcut.refresh}>
          <button
            type='button'
            aria-label='Refresh preview'
            onClick={forceRefreshPreview}
            className={iconBtn}
          >
            <RefreshCw size={14} />
          </button>
        </ToolbarTip>

        <div
          className={cn('relative', isCompact && 'hidden sm:block')}
          ref={cdnMenuRef}
        >
          <ToolbarTip
            label='Inject CDN library'
            shortcut={`${shortcut.cdnOpen} / ${shortcut.cdnEscape}`}
            feedback={tipFeedback.cdn}
          >
            <button
              ref={cdnButtonRef}
              type='button'
              aria-label='Inject CDN library'
              disabled={readOnly}
              aria-haspopup='menu'
              aria-expanded={cdnOpen}
              aria-controls='html-cdn-menu'
              onClick={() => setCdnOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && !cdnOpen) {
                  e.preventDefault()
                  setCdnOpen(true)
                }
              }}
              className='flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
            >
              <FileCode2 size={12} />
              <span className='hidden sm:inline'>CDN</span>
            </button>
          </ToolbarTip>
          {cdnOpen && (
            <div
              id='html-cdn-menu'
              role='menu'
              aria-label='CDN libraries'
              className='absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900'
            >
              {CDN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type='button'
                  role='menuitem'
                  onClick={() => injectCdn(p.snippet)}
                  className='block w-full rounded-md px-2 py-1.5 text-left text-xs cursor-pointer text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
                >
                  {p.label}
                </button>
              ))}
              <div className='mt-2 flex gap-1'>
                <input
                  value={customCdn}
                  onChange={(e) => setCustomCdn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      injectCdn(customCdn)
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setCdnOpen(false)
                      cdnButtonRef.current?.focus()
                    }
                  }}
                  placeholder='Custom <link> or <script>'
                  aria-label='Custom CDN snippet'
                  className='flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
                />
                <ToolbarTip label='Add CDN' shortcut={shortcut.cdnAdd}>
                  <button
                    type='button'
                    onClick={() => injectCdn(customCdn)}
                    className='rounded bg-emerald-600 px-2 text-[11px] text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
                  >
                    Add
                  </button>
                </ToolbarTip>
              </div>
            </div>
          )}
        </div>

        <div className='h-4 w-px bg-zinc-200 dark:bg-zinc-700 hidden md:block' />

        <div
          role='group'
          aria-label='Device size'
          className='hidden md:flex items-center gap-0.5'
        >
          {(
            [
              ['desktop', Monitor, 'Desktop width'],
              ['tablet', Tablet, 'Tablet width'],
              ['mobile', Smartphone, 'Mobile width'],
            ] as const
          ).map(([size, Icon, label]) => (
            <ToolbarTip key={size} label={label}>
              <button
                type='button'
                aria-label={label}
                aria-pressed={device === size}
                onClick={() => setDevice(size)}
                className={toolbarBtn(device === size)}
              >
                <Icon size={14} />
              </button>
            </ToolbarTip>
          ))}
        </div>

        <div className='hidden sm:flex items-center gap-0.5'>
          <ToolbarTip label='Zoom out'>
            <button
              type='button'
              aria-label='Zoom out'
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className={toolbarBtn(false)}
            >
              <ZoomOut size={14} />
            </button>
          </ToolbarTip>
          <span
            className='text-[10px] tabular-nums text-zinc-500 w-8 text-center'
            aria-live='polite'
          >
            {zoom}%
          </span>
          <ToolbarTip label='Zoom in'>
            <button
              type='button'
              aria-label='Zoom in'
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className={toolbarBtn(false)}
            >
              <ZoomIn size={14} />
            </button>
          </ToolbarTip>
        </div>

        <div className='flex-1' />

        <ToolbarTip label='Copy HTML to clipboard' feedback={tipFeedback.copy}>
          <button
            type='button'
            aria-label='Copy HTML'
            onClick={copyHtml}
            className={iconBtn}
          >
            <Copy size={14} />
          </button>
        </ToolbarTip>
        <ToolbarTip
          label='Download .html file'
          shortcut={shortcut.download}
          feedback={tipFeedback.download}
        >
          <button
            type='button'
            aria-label='Download HTML'
            onClick={downloadHtml}
            className={iconBtn}
          >
            <Download size={14} />
          </button>
        </ToolbarTip>
        <ToolbarTip label='Print / save as PDF'>
          <button
            type='button'
            aria-label='Print or save as PDF'
            onClick={printPdf}
            className={iconBtn}
          >
            <Printer size={14} />
          </button>
        </ToolbarTip>
        <ToolbarTip label='Open preview in new tab'>
          <button
            type='button'
            aria-label='Open preview in new tab'
            onClick={openInNewTab}
            className={cn(iconBtn, 'hidden sm:inline-flex')}
          >
            <ExternalLink size={14} />
          </button>
        </ToolbarTip>
        <ToolbarTip label='Toggle console' shortcut={shortcut.console}>
          <button
            type='button'
            aria-label='Toggle console'
            aria-pressed={showConsole}
            onClick={toggleConsole}
            className={toolbarBtn(showConsole)}
          >
            <Terminal size={14} />
          </button>
        </ToolbarTip>
      </div>

      {!safeMode && (
        <div className='shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-800 text-xs border-b border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'>
          <AlertTriangle size={14} className='shrink-0' />
          Safe Mode is off — scripts and event handlers will run inside the
          sandboxed iframe.
        </div>
      )}

      {/* Panes */}
      <div
        ref={panesRef}
        className={cn(
          'flex-1 min-h-0 overflow-hidden relative',
          viewMode === 'split' && isStackedSplit ? 'flex flex-col' : 'flex'
        )}
      >
        {showSource && (
          <div
            className={cn(
              'min-w-0 min-h-0 overflow-hidden',
              viewMode === 'split' && isStackedSplit
                ? 'border-b border-zinc-200 dark:border-zinc-800'
                : 'self-stretch border-r border-zinc-200 dark:border-zinc-800'
            )}
            style={
              viewMode === 'split'
                ? isStackedSplit
                  ? { height: `${leftWidth}%`, width: '100%' }
                  : { width: `${leftWidth}%` }
                : { width: '100%', height: '100%' }
            }
          >
            <Editor
              height='100%'
              language='html'
              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
              value={content}
              onChange={(v) => {
                if (!readOnly) onChange(v ?? '')
              }}
              onMount={onEditorMount}
              options={{
                readOnly,
                minimap: { enabled: false },
                fontSize: isCompact ? 12 : 13,
                lineNumbers: isCompact ? 'off' : 'on',
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                scrollBeyondLastLine: false,
                folding: !isCompact,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                formatOnPaste: true,
                find: { autoFindInSelection: 'never' },
              }}
            />
          </div>
        )}

        {showSource && showPreview && viewMode === 'split' && (
          <div
            role='separator'
            aria-orientation={isStackedSplit ? 'horizontal' : 'vertical'}
            aria-label='Resize editor panes'
            onPointerDown={startResize}
            onPointerMove={onPanePointerMove}
            onPointerUp={endPaneResize}
            onPointerCancel={endPaneResize}
            onLostPointerCapture={() => setIsDragging(false)}
            className={cn(
              'shrink-0 bg-zinc-100 hover:bg-emerald-500/40 dark:bg-zinc-900 transition-colors touch-none',
              isStackedSplit
                ? 'h-1.5 w-full cursor-row-resize'
                : 'w-1.5 cursor-col-resize',
              isDragging && 'bg-emerald-500/50'
            )}
          />
        )}

        {showPreview && (
          <div
            ref={previewColumnRef}
            className='min-w-0 min-h-0 flex flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-900/50 self-stretch'
            style={
              viewMode === 'split'
                ? isStackedSplit
                  ? { height: `${100 - leftWidth}%`, width: '100%' }
                  : { width: `${100 - leftWidth}%` }
                : { width: '100%', height: '100%' }
            }
          >
            {/*
              Outer overflow-auto is the scroll container. The iframe is sized to
              its document height so wheel/trackpad always scrolls this pane —
              even after the console eats most of the column height.
            */}
            <div
              ref={previewScrollRef}
              className={cn(
                'relative flex-1 min-h-0 overflow-auto overscroll-contain',
                isCompact ? 'p-2' : 'p-3'
              )}
              onWheel={(e) => {
                // Keep wheel on the preview pane (don't let it chain to page/monaco)
                e.stopPropagation()
              }}
            >
              <div
                className='mx-auto w-full max-w-full'
                style={
                  !cssZoomSupported && zoom !== 100
                    ? {
                        // Firefox has no CSS zoom — reserve scaled box so scroll height is correct
                        height: Math.max(
                          1,
                          Math.ceil(iframeDocHeight * (zoom / 100))
                        ),
                        overflow: 'hidden',
                      }
                    : undefined
                }
              >
                <div
                  className='mx-auto bg-white shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden w-full max-w-full'
                  style={{
                    width: isCompact ? '100%' : DEVICE_WIDTH[device],
                    ...(cssZoomSupported
                      ? ({ zoom: zoom / 100 } as React.CSSProperties)
                      : zoom !== 100
                        ? {
                            transform: `scale(${zoom / 100})`,
                            transformOrigin: 'top left',
                          }
                        : undefined),
                  }}
                >
                  <iframe
                    key={`${refreshKey}-${safeMode ? 'safe' : 'unsafe'}`}
                    ref={iframeRef}
                    title='HTML Preview'
                    className={cn(
                      'block w-full max-w-full border-0 bg-white',
                      (isConsoleDragging || isDragging) && 'pointer-events-none'
                    )}
                    style={{
                      height: iframeDocHeight,
                      minHeight: 1,
                    }}
                    onLoad={fitIframeToContent}
                    sandbox={
                      safeMode
                        ? 'allow-same-origin'
                        : 'allow-scripts allow-modals allow-forms'
                    }
                    srcDoc={previewHtml}
                  />
                </div>
              </div>
            </div>

            {showConsole && (
              <>
                <div
                  role='separator'
                  aria-orientation='horizontal'
                  aria-label='Resize console'
                  aria-valuenow={consoleHeight}
                  tabIndex={0}
                  title='Drag to resize console'
                  onPointerDown={startConsoleResize}
                  onPointerMove={onConsolePointerMove}
                  onPointerUp={endConsoleResize}
                  onPointerCancel={endConsoleResize}
                  onLostPointerCapture={() => setIsConsoleDragging(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setConsoleHeight((h) => clampConsoleHeight(h + 16))
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setConsoleHeight((h) => clampConsoleHeight(h - 16))
                    }
                  }}
                  className={cn(
                    'shrink-0 h-3 -mb-1 cursor-row-resize relative z-10 touch-none',
                    'flex items-center justify-center',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500'
                  )}
                >
                  <span
                    className={cn(
                      'block w-full h-1 rounded-full transition-colors',
                      'bg-zinc-300 hover:bg-emerald-500/70 dark:bg-zinc-700',
                      isConsoleDragging && 'bg-emerald-500'
                    )}
                  />
                </div>
                <div
                  className='shrink-0 border-zinc-800 bg-zinc-950 text-zinc-200 flex flex-col min-h-0 overflow-hidden'
                  style={{ height: consoleHeight }}
                  role='log'
                  aria-label='Preview console'
                  aria-live='polite'
                >
                  <div className='flex items-center justify-between px-2 py-1 border-b border-zinc-800 text-[10px] uppercase tracking-wide text-zinc-400 shrink-0'>
                    <span className='flex items-center gap-1 normal-case tracking-normal'>
                      <Terminal size={12} />
                      Console
                      {safeMode && (
                        <span className='text-amber-500/90 hidden sm:inline'>
                          — turn off Safe Mode to run scripts & capture logs
                        </span>
                      )}
                    </span>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        className='hover:text-white uppercase text-[10px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded'
                        onClick={() => setConsoleEntries([])}
                      >
                        Clear
                      </button>
                      <ToolbarTip
                        label='Hide console'
                        shortcut={shortcut.console}
                        side='top'
                      >
                        <button
                          type='button'
                          className='hover:text-white uppercase text-[10px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded'
                          onClick={toggleConsole}
                          aria-label='Hide console'
                        >
                          Hide
                        </button>
                      </ToolbarTip>
                    </div>
                  </div>
                  <div className='flex-1 min-h-0 overflow-auto font-mono text-[11px] px-2 py-1 space-y-0.5'>
                    {consoleEntries.length === 0 ? (
                      <div className='text-zinc-600'>No output yet</div>
                    ) : (
                      consoleEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={cn(
                            'whitespace-pre-wrap break-words',
                            entry.level === 'error' && 'text-red-400',
                            entry.level === 'warn' && 'text-amber-400',
                            entry.level === 'info' && 'text-sky-400',
                            entry.level === 'log' && 'text-zinc-300'
                          )}
                        >
                          <span className='text-zinc-600 mr-2'>
                            [{entry.level}]
                          </span>
                          {entry.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className='shrink-0 flex items-center justify-between gap-3 px-3 py-1 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500'>
        <span>
          {wordCount} words · {charCount} chars
        </span>
        {lintHints.length > 0 && (
          <span
            className='text-amber-600 dark:text-amber-400 truncate'
            title={lintHints.join(' · ')}
          >
            ⚠ {lintHints[0]}
            {lintHints.length > 1 ? ` (+${lintHints.length - 1})` : ''}
          </span>
        )}
        {isDesktopLayout && (
          <span className='flex items-center gap-2 shrink-0'>
            {viewMode === 'split' ? (
              <Maximize2 size={10} className='opacity-50' />
            ) : (
              <Minimize2 size={10} className='opacity-50' />
            )}
            {`${shortcut.download} download · ${shortcut.refresh} refresh · ${shortcut.console} console`}
          </span>
        )}
      </div>

      {/* Phone: thumb-friendly Code / Preview / Both switcher */}
      {isCompact && (
        <div
          className='shrink-0 grid grid-cols-3 gap-1 p-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 pb-[max(0.375rem,env(safe-area-inset-bottom))]'
          role='tablist'
          aria-label='Editor view'
        >
          {(
            [
              ['source', Code2, 'Code'],
              ['preview', Eye, 'Preview'],
              ['split', Columns2, 'Both'],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type='button'
              role='tab'
              aria-selected={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                viewMode === mode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={safeModeDialogOpen}
        title='Turn off Safe Mode?'
        description='Scripts and event handlers in your HTML will execute inside the sandboxed preview iframe. Only continue if you trust this content.'
        confirmLabel='Turn off Safe Mode'
        cancelLabel='Keep Safe Mode'
        tone='warning'
        onConfirm={confirmDisableSafeMode}
        onCancel={cancelDisableSafeMode}
      />
    </div>
  )
}

export default HtmlEditor
export { DEFAULT_HTML }
