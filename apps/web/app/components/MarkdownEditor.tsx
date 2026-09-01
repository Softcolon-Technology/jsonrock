'use client'

import React, { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  vscDarkPlus,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'
import matter from 'gray-matter'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import {
  UploadCloud,
  Download,
  Copy,
  Check,
  List,
  X,
  Tag,
  Calendar,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import mermaid from 'mermaid'
import MarkdownPreviewEditor from './MarkdownPreviewEditor'

const SOURCE_COLLAPSED_STORAGE_KEY = 'jsonrock_markdown_source_collapsed'

function readSourceCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SOURCE_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeSourceCollapsedPreference(collapsed: boolean) {
  try {
    localStorage.setItem(SOURCE_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // Ignore quota / private-mode failures — preference just won't persist.
  }
}

// ─── Mermaid Diagram ────────────────────────────────────────────────────────

const mermaidCache = new Map<string, string>()
const mermaidPrefixCache = new Map<string, string>()

const getIsDarkMode = () =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark')

const getMermaidConfig = (isDark: boolean) => ({
  startOnLoad: false,
  securityLevel: 'loose' as const,
  theme: isDark ? ('dark' as const) : ('default' as const),
  themeVariables: isDark
    ? {
        // Base
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
        // Sequence diagrams (arrows + labels were near-invisible on dark bg)
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
    : undefined,
})

const Mermaid = ({ chart }: { chart: string }) => {
  const prefix = chart.substring(0, 30)
  const [isDark, setIsDark] = useState(getIsDarkMode)
  const cacheKey = `${isDark ? 'dark' : 'light'}:${chart}`
  const prefixKey = `${isDark ? 'dark' : 'light'}:${prefix}`

  const [svg, setSvg] = useState<string>(() => {
    return mermaidCache.get(cacheKey) || mermaidPrefixCache.get(prefixKey) || ''
  })

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

  useEffect(() => {
    if (mermaidCache.has(cacheKey)) {
      setSvg(mermaidCache.get(cacheKey)!)
      return
    }

    // Restore last valid diagram for this theme while typing (anti-blink)
    const cachedPrefix = mermaidPrefixCache.get(prefixKey)
    if (cachedPrefix) setSvg(cachedPrefix)

    mermaid.initialize(getMermaidConfig(isDark))

    let isMounted = true

    const renderChart = async () => {
      try {
        await mermaid.parse(chart)
        if (!isMounted) return
        const renderId = `mermaid-${Math.random().toString(36).substring(2, 10)}`
        const { svg: newSvg } = await mermaid.render(renderId, chart)
        if (isMounted) {
          mermaidCache.set(cacheKey, newSvg)
          mermaidPrefixCache.set(prefixKey, newSvg)
          setSvg(newSvg)
        }
      } catch {
        // keep last valid svg on parse/render error
      }
    }

    // Debounce while typing; re-theme immediately when dark/light toggles
    const alreadyRendered =
      mermaidCache.has(`dark:${chart}`) || mermaidCache.has(`light:${chart}`)
    const timeoutId = setTimeout(renderChart, alreadyRendered ? 0 : 400)
    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [chart, cacheKey, prefixKey, isDark])

  return svg ? (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className={cn(
        'flex justify-center my-4 overflow-x-auto rounded-lg p-4 shadow-sm border',
        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
      )}
    />
  ) : (
    <pre className='bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded text-sm text-zinc-500 italic border border-zinc-200 dark:border-zinc-800 my-4'>
      Rendering diagram...
    </pre>
  )
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

const CopyButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <button
      onClick={handleCopy}
      title='Copy code'
      className='absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 bg-zinc-700/60 hover:bg-zinc-600/80 text-zinc-300 hover:text-white border border-zinc-600/40'
    >
      {copied ? (
        <>
          <Check className='w-3 h-3' />
          Copied
        </>
      ) : (
        <>
          <Copy className='w-3 h-3' />
          Copy
        </>
      )}
    </button>
  )
}

// ─── Front-Matter Banner ─────────────────────────────────────────────────────

const FrontMatterBanner = ({ data }: { data: Record<string, any> }) => {
  if (!data || Object.keys(data).length === 0) return null

  const { title, date, author, tags, ...rest } = data

  return (
    <div className='mb-6 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-sm'>
      {title && (
        <h1 className='text-2xl font-bold text-emerald-800 dark:text-emerald-300 mb-2'>
          {String(title)}
        </h1>
      )}
      <div className='flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400'>
        {author && (
          <span className='flex items-center gap-1'>
            <User className='w-3 h-3' />
            {String(author)}
          </span>
        )}
        {date && (
          <span className='flex items-center gap-1'>
            <Calendar className='w-3 h-3' />
            {String(date)}
          </span>
        )}
        {tags && (
          <span className='flex items-center gap-1 flex-wrap'>
            <Tag className='w-3 h-3 shrink-0' />
            {(Array.isArray(tags) ? tags : [tags]).map((t: any) => (
              <span
                key={t}
                className='px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-medium'
              >
                {String(t)}
              </span>
            ))}
          </span>
        )}
        {Object.entries(rest).map(([k, v]) => (
          <span key={k} className='flex items-center gap-1'>
            <span className='font-semibold'>{k}:</span> {String(v)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Table of Contents ───────────────────────────────────────────────────────

interface TocItem {
  id: string
  text: string
  level: number
}

const extractToc = (markdown: string): TocItem[] => {
  const lines = markdown.split('\n')
  const items: TocItem[] = []
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim())
    if (match && match[1] && match[2]) {
      const level = match[1].length
      const text = match[2].replace(/\*\*|__|\*|_|`|~~|#+/g, '').trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      items.push({ id, text, level })
    }
  }
  return items
}

const TableOfContents = ({
  items,
  onClose,
}: {
  items: TocItem[]
  onClose: () => void
}) => {
  if (items.length === 0) return null
  const minLevel = Math.min(...items.map((i) => i.level))

  return (
    <div className='absolute top-0 right-0 bottom-0 z-30 w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-xl'>
      <div className='flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0'>
        <span className='text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400'>
          Table of Contents
        </span>
        <button
          onClick={onClose}
          className='p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors'
        >
          <X className='w-3.5 h-3.5' />
        </button>
      </div>
      <nav className='flex-1 overflow-y-auto p-3 space-y-0.5'>
        {items.map((item, i) => (
          <a
            key={i}
            href={`#${item.id}`}
            onClick={onClose}
            style={{ paddingLeft: `${(item.level - minLevel) * 12 + 8}px` }}
            className='block py-1.5 pr-2 text-sm rounded text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors truncate'
          >
            {item.text}
          </a>
        ))}
      </nav>
    </div>
  )
}

// ─── Download Helpers ────────────────────────────────────────────────────────

const handleMarkdownDownload = async (
  content: string,
  requestedFilename: string
) => {
  let filePicked = false
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
      filePicked = true
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error(err)
    if (err.name === 'AbortError') return
  }
  if (filePicked) return
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = requestedFilename
  a.click()
  URL.revokeObjectURL(url)
}

/** Strip `dark` so Tailwind `dark:` variants and `.dark` rules don't apply in exports. */
const stripDarkClass = (className: string) =>
  className
    .replace(/\bdark\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Light-mode markdown colors for PDF/DOC export.
 * Print/PDF always renders on a white page — never inherit app dark-theme colors.
 */
const MARKDOWN_EXPORT_LIGHT_STYLES = `
  html, body {
    background-color: #ffffff !important;
    color: #3f3f46;
  }
  h1 { color: #18181b; border-bottom-color: #e4e4e7; }
  h2 { color: #27272a; border-bottom-color: #e4e4e7; }
  h3, h4, h5 { color: #27272a; }
  h6 { color: #71717a; }
  p, li, em, td, th { color: #3f3f46; }
  blockquote {
    background-color: #ecfdf5 !important;
    border-left-color: #10b981 !important;
    color: #52525b !important;
  }
  strong { color: #18181b; }
  a { color: #059669; }
  code:not(pre code) {
    background-color: #f4f4f5 !important;
    color: #059669 !important;
    border-color: #e4e4e7 !important;
  }
  hr { border-color: #e4e4e7; }
  thead { background-color: #f4f4f5; color: #71717a; }
  table { color: #3f3f46; }
  tr { background-color: #ffffff; }
  del { color: #a1a1aa; }
`

const MARKDOWN_EXPORT_PRINT_STYLES = `
  @media print {
    @page { margin: 0; }
    html, body {
      background-color: #ffffff !important;
      color: #3f3f46 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { margin: 0; padding: 15mm; }
    * { overflow: visible !important; }
    h1 { color: #18181b !important; border-bottom-color: #e4e4e7 !important; }
    h2 { color: #27272a !important; border-bottom-color: #e4e4e7 !important; }
    h3, h4, h5 { color: #27272a !important; }
    h6 { color: #71717a !important; }
    p, li, em, td, th { color: #3f3f46 !important; }
    blockquote {
      background-color: #ecfdf5 !important;
      border-left-color: #10b981 !important;
      color: #52525b !important;
    }
    strong { color: #18181b !important; }
    a { color: #059669 !important; }
    code:not(pre code) {
      background-color: #f4f4f5 !important;
      color: #059669 !important;
      border-color: #e4e4e7 !important;
    }
    hr { border-color: #e4e4e7 !important; }
    thead { background-color: #f4f4f5 !important; color: #71717a !important; }
    table { color: #3f3f46 !important; }
    tr { background-color: #ffffff !important; }
    del { color: #a1a1aa !important; }
  }
`

const handleDocDownload = async (
  htmlContent: string,
  requestedFilename: string
) => {
  const header =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Document</title><style>" +
    MARKDOWN_EXPORT_LIGHT_STYLES +
    '</style></head><body>'
  const footer = '</body></html>'
  const sourceHTML = header + htmlContent + footer
  let filePicked = false
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
      filePicked = true
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error(err)
    if (err.name === 'AbortError') return
  }
  if (filePicked) return
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

const handlePdfDownload = async (
  element: HTMLElement,
  requestedFilename: string
) => {
  try {
    const iframe = document.createElement('iframe')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
    })
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    const styles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((s) => s.outerHTML)
      .join('\n')
    const lightClassName = stripDarkClass(document.documentElement.className)
    const title = requestedFilename.replace(/\.pdf$/, '')
    doc.write(`
      <html class="${lightClassName}">
        <head>
          <title>${title}</title>
          ${styles}
          <style>
            ${MARKDOWN_EXPORT_LIGHT_STYLES}
            ${MARKDOWN_EXPORT_PRINT_STYLES}
          </style>
        </head>
        <body class="${lightClassName} bg-white">
          <div class="p-8">${element.innerHTML}</div>
        </body>
      </html>
    `)
    doc.close()
    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 500)
  } catch (err) {
    console.error('Failed to generate PDF:', err)
  }
}

// ─── Markdown Components ─────────────────────────────────────────────────────

const isDarkMode = () =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark')

const buildMdComponents = (): React.ComponentProps<
  typeof ReactMarkdown
>['components'] => ({
  h1: ({ children, id }) => (
    <h1
      id={id}
      className='text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-8 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700 first:mt-0 leading-tight scroll-mt-4'
    >
      {children}
    </h1>
  ),
  h2: ({ children, id }) => (
    <h2
      id={id}
      className='text-2xl font-bold text-zinc-800 dark:text-zinc-200 mt-7 mb-3 pb-1.5 border-b border-zinc-200 dark:border-zinc-700 leading-tight scroll-mt-4'
    >
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3
      id={id}
      className='text-xl font-semibold text-zinc-800 dark:text-zinc-200 mt-6 mb-2.5 leading-tight scroll-mt-4'
    >
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4
      id={id}
      className='text-lg font-semibold text-zinc-700 dark:text-zinc-300 mt-5 mb-2 leading-tight scroll-mt-4'
    >
      {children}
    </h4>
  ),
  h5: ({ children, id }) => (
    <h5
      id={id}
      className='text-base font-semibold text-zinc-700 dark:text-zinc-300 mt-4 mb-1.5 leading-tight scroll-mt-4'
    >
      {children}
    </h5>
  ),
  h6: ({ children, id }) => (
    <h6
      id={id}
      className='text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-4 mb-1.5 uppercase tracking-wide leading-tight scroll-mt-4'
    >
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className='text-zinc-700 dark:text-zinc-300 leading-7 mb-4 last:mb-0'>
      {children}
    </p>
  ),
  a: ({ href, children, title }) => (
    <a
      href={href}
      title={title}
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
  // ── Code (inline & fenced) ──────────────────────────────────────────────
  code: ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '')
    const lang = match?.[1]
    const codeString = String(children).replace(/\n$/, '')

    // Mermaid diagram
    if (lang === 'mermaid') {
      return <Mermaid chart={codeString} />
    }

    // Fenced code block with language → syntax highlighting
    if (lang) {
      return (
        <div className='relative my-4 rounded-lg overflow-hidden border border-zinc-700/50 shadow-md group'>
          {/* Language badge */}
          <div className='flex items-center justify-between px-4 py-1.5 bg-zinc-800 border-b border-zinc-700/50'>
            <span className='text-[10px] font-bold uppercase tracking-widest text-zinc-400'>
              {lang}
            </span>
          </div>
          <CopyButton code={codeString} />
          <SyntaxHighlighter
            language={lang}
            style={isDarkMode() ? vscDarkPlus : oneLight}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '0.82rem',
              padding: '1.1rem 1rem',
              background: isDarkMode() ? '#1e1e1e' : '#fafafa',
            }}
            showLineNumbers
            wrapLongLines={false}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      )
    }

    // Inline code
    return (
      <code
        className={cn(
          'px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/50 text-emerald-600 dark:text-emerald-400 font-mono text-[0.875em] border border-zinc-200 dark:border-zinc-700/50',
          className
        )}
        {...props}
      >
        {children}
      </code>
    )
  },
  // pre is now handled by the code component wrapping it, but we keep a fallback
  pre: ({ children }) => (
    <pre className='relative bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 my-4 overflow-x-auto text-zinc-800 dark:text-zinc-200 text-sm font-mono leading-relaxed shadow-sm [&>code]:bg-transparent! [&>code]:border-none! [&>code]:p-0! [&>code]:text-inherit! [&>code]:block!'>
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
  img: ({ src, alt, title }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      title={title}
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
  // Footnotes section
  section: ({ children, className, ...props }: any) => {
    if (className?.includes('footnotes')) {
      return (
        <section
          className='mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400'
          {...props}
        >
          <p className='text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3'>
            Footnotes
          </p>
          {children}
        </section>
      )
    }
    return (
      <section className={className} {...props}>
        {children}
      </section>
    )
  },
})

// ─── Rehype sanitize schema allowing math & slug attrs ───────────────────────

const rehypeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'className',
      'class',
      'id',
      'style',
      'align',
      'width',
      'height',
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      'className',
      'class',
      'style',
      'align',
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'className',
      'class',
      'style',
      'aria-hidden',
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'target',
      'rel',
      'className',
      'class',
      'style',
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      'src',
      'alt',
      'title',
      'width',
      'height',
      'className',
      'class',
      'style',
    ],
    table: [
      ...(defaultSchema.attributes?.table ?? []),
      'className',
      'class',
      'style',
      'align',
    ],
    td: [
      ...(defaultSchema.attributes?.td ?? []),
      'colSpan',
      'rowSpan',
      'align',
      'style',
    ],
    th: [
      ...(defaultSchema.attributes?.th ?? []),
      'colSpan',
      'rowSpan',
      'align',
      'style',
    ],
    details: [...(defaultSchema.attributes?.details ?? []), 'open'],
    math: ['className', 'style'],
    'math-inline': ['className', 'style'],
    'math-display': ['className', 'style'],
    annotation: ['encoding'],
    semantics: [],
    mrow: [],
    mi: ['mathvariant'],
    mo: [],
    mn: [],
    msup: [],
    msub: [],
    mfrac: ['linethickness'],
    mspace: ['width', 'height', 'depth'],
    svg: [
      'viewBox',
      'xmlns',
      'width',
      'height',
      'role',
      'focusable',
      'aria-hidden',
    ],
    path: [
      'd',
      'fill',
      'stroke',
      'strokeWidth',
      'strokeLinecap',
      'strokeLinejoin',
    ],
    g: ['transform', 'fill', 'stroke'],
    use: ['href', 'x', 'y'],
    defs: [],
    symbol: ['id', 'viewBox'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // Common HTML often written inline in markdown
    'div',
    'span',
    'section',
    'article',
    'aside',
    'header',
    'footer',
    'main',
    'nav',
    'figure',
    'figcaption',
    'details',
    'summary',
    'mark',
    'kbd',
    'sub',
    'sup',
    'abbr',
    'cite',
    'q',
    'time',
    'video',
    'audio',
    'source',
    // KaTeX / SVG
    'math',
    'annotation',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msup',
    'msub',
    'mfrac',
    'mspace',
    'svg',
    'path',
    'g',
    'use',
    'defs',
    'symbol',
  ],
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface MarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  readOnly?: boolean
  onFileDrop?: (file: File) => Promise<void>
  slug?: string | null
  /**
   * Shared markdown link with previewOnly — hide source pane and editing chrome.
   * Owners editing their own doc must not pass this.
   */
  sharePreviewOnly?: boolean
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarkdownEditor({
  content,
  onChange,
  readOnly = false,
  onFileDrop,
  slug,
  sharePreviewOnly = false,
}: MarkdownEditorProps) {
  const [leftWidth, setLeftWidth] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showToc, setShowToc] = useState(false)
  // Default expanded (false); hydrate from localStorage after mount (SSR-safe).
  const [isSourceCollapsed, setIsSourceCollapsed] = useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const previewRef = React.useRef<HTMLDivElement>(null)
  const isSyncing = React.useRef(false)

  const effectivelyCollapsed = sharePreviewOnly || isSourceCollapsed
  const effectivelyReadOnly = readOnly || sharePreviewOnly

  useEffect(() => {
    if (sharePreviewOnly) return
    setIsSourceCollapsed(readSourceCollapsedPreference())
  }, [sharePreviewOnly])

  const toggleSourceCollapsed = React.useCallback(() => {
    setIsSourceCollapsed((prev) => {
      const next = !prev
      writeSourceCollapsedPreference(next)
      return next
    })
  }, [])

  const debouncedContent = useDebounce(content, 150)

  // Parse front-matter, stripping it from the rendered body
  const { frontMatter, markdownBody } = useMemo(() => {
    try {
      const parsed = matter(debouncedContent)
      return { frontMatter: parsed.data, markdownBody: parsed.content }
    } catch {
      return { frontMatter: {}, markdownBody: debouncedContent }
    }
  }, [debouncedContent])

  // Table of Contents items
  const tocItems = useMemo(() => extractToc(markdownBody), [markdownBody])

  // Pre-build md components (stable ref avoids re-creating components on every render)
  const mdComponents = useMemo(() => buildMdComponents(), [])

  // ── Scroll sync ────────────────────────────────────────────────────────────
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

  // ── Resizing ───────────────────────────────────────────────────────────────
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

  // ── Drag & Drop ────────────────────────────────────────────────────────────
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
    if (file && onFileDrop) await onFileDrop(file)
  }

  const frontMatterBanner =
    Object.keys(frontMatter).length > 0 ? (
      <FrontMatterBanner data={frontMatter} />
    ) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className='flex h-full w-full overflow-hidden bg-white dark:bg-[#050505] flex-col md:flex-row relative'
      style={{ '--editor-left-width': `${leftWidth}%` } as React.CSSProperties}
    >
      {/* ── Left Pane — Raw Editor ─────────────────────────────────────── */}
      {!effectivelyCollapsed && (
        <div
          className={cn(
            'w-full md:w-(--editor-left-width) min-w-50 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col relative transition-colors duration-200',
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
          <div className='flex items-center px-4 py-1 bg-linear-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-11 shrink-0 gap-2'>
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
            readOnly={effectivelyReadOnly}
            placeholder={
              '# Hello!\n\nStart writing markdown...\n\n- Use **bold**, *italic*\n- Add `code` blocks\n- Create tables, lists & more\n- Write $math$ or $$LaTeX$$\n- Draw ```mermaid diagrams```'
            }
            spellCheck={false}
          />
        </div>
      )}

      {/* ── Drag Handle ───────────────────────────────────────────────── */}
      {!effectivelyCollapsed && (
        <div
          className='hidden md:flex w-1.5 bg-transparent hover:bg-emerald-500/30 dark:hover:bg-emerald-500/20 cursor-col-resize z-40 items-center justify-center transition-colors shrink-0'
          onMouseDown={startResizing}
        />
      )}

      {/* ── Right Pane — Preview ──────────────────────────────────────── */}
      <div className='flex-1 overflow-hidden bg-white dark:bg-[#0a0a0a] min-w-50 flex flex-col relative'>
        <div className='flex items-center px-4 py-1 bg-linear-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-11 shrink-0 gap-2'>
          <span className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>
            Preview
          </span>
          <div className='flex-1' />

          {/* Collapse / expand source pane */}
          {!sharePreviewOnly && (
            <button
              type='button'
              onClick={toggleSourceCollapsed}
              title={
                isSourceCollapsed
                  ? 'Show markdown source'
                  : 'Hide markdown source (full-width preview)'
              }
              aria-label={
                isSourceCollapsed
                  ? 'Show markdown source'
                  : 'Hide markdown source'
              }
              aria-pressed={isSourceCollapsed}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors',
                isSourceCollapsed
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
              )}
            >
              {isSourceCollapsed ? (
                <PanelLeftOpen size={14} />
              ) : (
                <PanelLeftClose size={14} />
              )}
            </button>
          )}

          {/* Table of Contents toggle */}
          {tocItems.length > 0 && (
            <button
              onClick={() => setShowToc((v) => !v)}
              title='Table of Contents'
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors',
                showToc
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
              )}
            >
              <List size={14} />
              <span className='sr-only md:not-sr-only'>ToC</span>
            </button>
          )}

          <button
            onClick={() => {
              if (slug && previewRef.current)
                handlePdfDownload(previewRef.current, 'document.pdf')
            }}
            disabled={!slug}
            title={
              !slug
                ? 'Save or create document first to download'
                : 'Download as PDF (.pdf)'
            }
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors',
              !slug
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
            )}
          >
            <Download size={14} />
            <span className='sr-only md:not-sr-only'>PDF</span>
          </button>
          <button
            onClick={() => {
              if (slug && previewRef.current)
                handleDocDownload(previewRef.current.innerHTML, 'document.doc')
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
            <span className='sr-only md:not-sr-only'>DOC</span>
          </button>
        </div>

        {/* Preview body + ToC overlay */}
        <div className='relative flex-1 overflow-hidden'>
          {showToc && (
            <TableOfContents
              items={tocItems}
              onClose={() => setShowToc(false)}
            />
          )}

          {effectivelyReadOnly ? (
            <div
              ref={previewRef}
              className='h-full overflow-y-auto p-8'
              onScroll={onPreviewScroll}
            >
              {debouncedContent.trim() ? (
                <>
                  {frontMatterBanner}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[
                      rehypeRaw,
                      [rehypeSanitize, rehypeSchema],
                      rehypeKatex,
                      rehypeSlug,
                    ]}
                    components={mdComponents}
                  >
                    {markdownBody}
                  </ReactMarkdown>
                </>
              ) : (
                <div className='h-full flex items-center justify-center'>
                  <p className='text-zinc-400 dark:text-zinc-600 text-sm italic'>
                    Preview will appear here as you type...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <MarkdownPreviewEditor
              content={content}
              onChange={onChange}
              scrollRef={previewRef}
              onScroll={effectivelyCollapsed ? undefined : onPreviewScroll}
              frontMatterBanner={frontMatterBanner}
            />
          )}
        </div>
      </div>
    </div>
  )
}
