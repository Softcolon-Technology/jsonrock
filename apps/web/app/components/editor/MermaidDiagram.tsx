'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const mermaidCache = new Map<string, string>()
const mermaidPrefixCache = new Map<string, string>()

/** Bump when layout/theme density changes so in-memory cache doesn't keep old SVGs. */
const MERMAID_LAYOUT_VERSION = 'fit-v1'

const MAX_CACHE_ENTRIES = 40
const MIN_SCALE = 0.35
const MAX_SCALE = 5
const ZOOM_STEP = 0.12
/** Default = fit entire diagram (all nodes visible). Zoom in with ⌘/Ctrl+scroll. */
const DEFAULT_SCALE = 1

const getIsDarkMode = () =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark')

const diagramThemeVariables = {
  fontSize: '14px',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
}

const getMermaidConfig = (isDark: boolean) => ({
  startOnLoad: false,
  securityLevel: 'loose' as const,
  theme: isDark ? ('dark' as const) : ('default' as const),
  flowchart: {
    htmlLabels: true,
    curve: 'basis' as const,
    padding: 12,
    nodeSpacing: 36,
    rankSpacing: 44,
    wrappingWidth: 200,
    // Scale SVG to container width so every node stays on-screen by default.
    useMaxWidth: true,
  },
  sequence: {
    actorMargin: 40,
    boxMargin: 8,
    boxTextMargin: 5,
    noteMargin: 8,
    messageMargin: 32,
    mirrorActors: false,
    useMaxWidth: true,
  },
  themeVariables: isDark
    ? {
        ...diagramThemeVariables,
        background: '#18181b',
        primaryColor: '#27272a',
        primaryTextColor: '#fafafa',
        primaryBorderColor: '#a1a1aa',
        secondaryColor: '#3f3f46',
        secondaryTextColor: '#f4f4f5',
        secondaryBorderColor: '#71717a',
        tertiaryColor: '#27272a',
        tertiaryTextColor: '#f4f4f5',
        tertiaryBorderColor: '#52525b',
        lineColor: '#a1a1aa',
        textColor: '#fafafa',
        mainBkg: '#27272a',
        nodeBorder: '#a1a1aa',
        clusterBkg: '#27272a',
        titleColor: '#fafafa',
        edgeLabelBackground: '#27272a',
        actorBkg: '#3f3f46',
        actorBorder: '#a78bfa',
        actorTextColor: '#fafafa',
        actorLineColor: '#71717a',
        signalColor: '#e4e4e7',
        signalTextColor: '#fafafa',
        labelBoxBkgColor: '#27272a',
        labelBoxBorderColor: '#71717a',
        labelTextColor: '#fafafa',
        loopTextColor: '#fafafa',
        noteBkgColor: '#3f3f46',
        noteTextColor: '#fafafa',
        noteBorderColor: '#71717a',
        activationBkgColor: '#52525b',
        activationBorderColor: '#a1a1aa',
        sequenceNumberColor: '#18181b',
      }
    : {
        ...diagramThemeVariables,
      },
})

type MermaidApi = typeof import('mermaid').default

let mermaidModulePromise: Promise<MermaidApi> | null = null
let initializedKey: string | null = null
let renderSeq = 0
/** Serialize renders — concurrent mermaid.render calls fight over the DOM. */
let renderChain: Promise<unknown> = Promise.resolve()

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((m) => m.default)
  }
  return mermaidModulePromise
}

/** Prefetch the mermaid chunk (e.g. when the markdown editor mounts). */
export function preloadMermaid(): void {
  void loadMermaid()
}

async function getMermaid(isDark: boolean): Promise<MermaidApi> {
  const mermaid = await loadMermaid()
  const key = `${MERMAID_LAYOUT_VERSION}:${isDark ? 'dark' : 'light'}`
  if (initializedKey !== key) {
    mermaid.initialize(getMermaidConfig(isDark))
    initializedKey = key
  }
  return mermaid
}

function trimCache(cache: Map<string, string>) {
  if (cache.size <= MAX_CACHE_ENTRIES) return
  const excess = cache.size - MAX_CACHE_ENTRIES
  const keys = cache.keys()
  for (let i = 0; i < excess; i++) {
    const key = keys.next().value
    if (key !== undefined) cache.delete(key)
  }
}

function cacheSet(cacheKey: string, prefixKey: string, svg: string) {
  mermaidCache.set(cacheKey, svg)
  mermaidPrefixCache.set(prefixKey, svg)
  trimCache(mermaidCache)
  trimCache(mermaidPrefixCache)
}

function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  const run = renderChain.then(task, task)
  // Keep the chain alive even if a task fails
  renderChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

/** ⌘ on Apple, Ctrl elsewhere — used for zoom / pan gestures. */
function isZoomModifier(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.metaKey || e.ctrlKey
}

function clampScale(n: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))
}

type MermaidDiagramProps = {
  chart: string
}

type ViewTransform = { scale: number; x: number; y: number }

/** Renders a Mermaid chart to SVG, with theme-aware caching and ⌘/Ctrl zoom+pan. */
export const MermaidDiagram = memo(function MermaidDiagram({
  chart,
}: MermaidDiagramProps) {
  const trimmed = chart.trim()
  const prefix = trimmed.substring(0, 30)
  const [isDark, setIsDark] = useState(getIsDarkMode)
  const themeKey = isDark ? 'dark' : 'light'
  const cacheKey = `${MERMAID_LAYOUT_VERSION}:${themeKey}:${trimmed}`
  const prefixKey = `${MERMAID_LAYOUT_VERSION}:${themeKey}:${prefix}`

  const [svg, setSvg] = useState<string>(() => {
    return mermaidCache.get(cacheKey) || mermaidPrefixCache.get(prefixKey) || ''
  })
  const [isRendering, setIsRendering] = useState(
    () => !mermaidCache.has(cacheKey)
  )
  const [transform, setTransform] = useState<ViewTransform>({
    scale: DEFAULT_SCALE,
    x: 0,
    y: 0,
  })
  const [isPanning, setIsPanning] = useState(false)
  const [modifierHeld, setModifierHeld] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const transformRef = useRef(transform)
  transformRef.current = transform

  // Reset view when the chart body changes meaningfully
  useEffect(() => {
    setTransform({ scale: DEFAULT_SCALE, x: 0, y: 0 })
  }, [trimmed])

  // Keep theme in sync when the app toggles dark/light mode
  useEffect(() => {
    const syncTheme = () => setIsDark(getIsDarkMode())
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  // Warm the mermaid chunk as soon as a diagram mounts
  useEffect(() => {
    void loadMermaid()
  }, [])

  // Track ⌘/Ctrl so the cursor can hint grab / zoom-ready
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') setModifierHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') setModifierHeld(false)
    }
    const onBlur = () => setModifierHeld(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    if (!trimmed) {
      setSvg('')
      setIsRendering(false)
      return
    }

    const cached = mermaidCache.get(cacheKey)
    if (cached) {
      setSvg(cached)
      setIsRendering(false)
      return
    }

    // Keep last valid diagram visible while typing (anti-blink)
    const cachedPrefix = mermaidPrefixCache.get(prefixKey)
    if (cachedPrefix) {
      setSvg(cachedPrefix)
    } else {
      setIsRendering(true)
    }

    let cancelled = false
    // First paint: render immediately. While editing: debounce to avoid thrashing.
    const delayMs = cachedPrefix ? 220 : 0

    const timeoutId = setTimeout(() => {
      void enqueueRender(async () => {
        if (cancelled) return
        try {
          const mermaid = await getMermaid(isDark)
          if (cancelled) return
          // Skip mermaid.parse() — render() already validates; parse doubles the cost.
          const renderId = `mmd-${++renderSeq}`
          const { svg: newSvg } = await mermaid.render(renderId, trimmed)
          if (cancelled) return
          cacheSet(cacheKey, prefixKey, newSvg)
          setSvg(newSvg)
        } catch {
          // keep last valid svg on parse/render error
        } finally {
          if (!cancelled) setIsRendering(false)
        }
      })
    }, delayMs)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [trimmed, cacheKey, prefixKey, isDark])

  // Native wheel listener (non-passive) so ⌘/Ctrl+scroll can prevent page zoom/scroll.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!isZoomModifier(e)) return
      e.preventDefault()
      e.stopPropagation()
      const direction = e.deltaY > 0 ? -1 : 1
      setTransform((prev) => {
        const nextScale = clampScale(prev.scale * (1 + direction * ZOOM_STEP))
        if (nextScale === prev.scale) return prev
        return { ...prev, scale: nextScale }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [svg])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isZoomModifier(e) || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const t = transformRef.current
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: t.x,
      originY: t.y,
    }
    setIsPanning(true)
    viewportRef.current?.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    e.preventDefault()
    setTransform({
      scale: transformRef.current.scale,
      x: pan.originX + (e.clientX - pan.startX),
      y: pan.originY + (e.clientY - pan.startY),
    })
  }, [])

  const endPan = useCallback((e: React.PointerEvent) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    panRef.current = null
    setIsPanning(false)
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
  }, [])

  const resetView = useCallback(() => {
    setTransform({ scale: DEFAULT_SCALE, x: 0, y: 0 })
  }, [])

  if (!trimmed) return null

  if (!svg) {
    return (
      <pre className='bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-xl text-sm text-zinc-500 italic border border-zinc-200 dark:border-zinc-800 my-4 min-h-24'>
        {isRendering ? 'Rendering diagram…' : 'Invalid Mermaid diagram'}
      </pre>
    )
  }

  const zoomed =
    transform.scale !== DEFAULT_SCALE || transform.x !== 0 || transform.y !== 0

  return (
    <div
      className={cn(
        'mermaid-diagram group relative my-4 w-full overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700',
        isRendering && 'opacity-90',
        isDark ? 'bg-zinc-900' : 'bg-white'
      )}
      data-testid='jr-mermaid-diagram'
    >
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={(e) => {
          if (isZoomModifier(e)) {
            e.preventDefault()
            resetView()
          }
        }}
        title='⌘/Ctrl + scroll to zoom · ⌘/Ctrl + drag to pan · ⌘/Ctrl + double-click to reset'
        className={cn(
          'flex min-h-48 w-full items-center justify-center overflow-hidden p-6 touch-none',
          modifierHeld || isPanning
            ? isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-default'
        )}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: 'center center',
            width: '100%',
          }}
          className={cn(
            'flex w-full justify-center [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:w-full',
            '[&_.nodeLabel]:text-[13px] [&_.nodeLabel]:leading-snug',
            '[&_.edgeLabel]:text-[12px] [&_.edgeLabel]:leading-snug',
            '[&_foreignObject_div]:!p-0 [&_foreignObject_span]:!leading-snug',
            isPanning ? '' : 'transition-transform duration-75 ease-out'
          )}
        />
      </div>
      {zoomed && (
        <button
          type='button'
          onClick={resetView}
          className={cn(
            'absolute right-2 top-2 rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
            isDark
              ? 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
          )}
        >
          Reset view
        </button>
      )}
    </div>
  )
})
