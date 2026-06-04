'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { DiffEditor, type BeforeMount } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import {
  ArrowRightLeft,
  Save,
  FolderOpen,
  Eraser,
  WrapText,
  Plus,
  Minus,
  Equal,
  Columns2,
  Rows2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveDiff, updateDiff, type DiffRecord } from '@/lib/diff-db'
import DiffHeader from './diff-header'
import SavedDiffsModal from './saved-diffs-modal'

// ─── Language auto-detection ──────────────────────────────────────────────────
function detectLanguage(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // JSON — starts with { or [ and is parseable
  if (/^[\[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // might still be JSON-like, check further
    }
  }

  // HTML — starts with < and has closing tags
  if (
    /^<(!DOCTYPE|html|head|body|div|span|p|a|script|style|link|meta|section|header|footer|main|nav|table|form|ul|ol|li|h[1-6])/i.test(
      trimmed
    )
  )
    return 'html'
  if (/<\/?[a-z][a-z0-9]*[\s>]/i.test(trimmed) && /<\/[a-z]/i.test(trimmed))
    return 'html'

  // XML — starts with <?xml or has xml-like structure without HTML tags
  if (/^<\?xml/i.test(trimmed)) return 'xml'

  // Dockerfile
  if (
    /^FROM\s+\S+/m.test(trimmed) &&
    /^(RUN|CMD|COPY|ADD|ENV|EXPOSE|WORKDIR|ENTRYPOINT)\s/m.test(trimmed)
  )
    return 'dockerfile'

  // YAML — key: value patterns, no braces
  if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s/m.test(trimmed) && /^\s*-\s/m.test(trimmed))
    return 'yaml'
  if (/^---\s*$/m.test(trimmed)) return 'yaml'

  // SQL
  if (
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\s/im.test(
      trimmed
    )
  )
    return 'sql'

  // Markdown — headings, links, code blocks
  if (
    /^#{1,6}\s/m.test(trimmed) &&
    (/\[.*\]\(.*\)/.test(trimmed) ||
      /^```/m.test(trimmed) ||
      /^\*\*/.test(trimmed))
  )
    return 'markdown'

  // GraphQL
  if (
    /^(type|query|mutation|subscription|fragment|schema|input|enum|interface|union)\s/m.test(
      trimmed
    ) &&
    /\{[\s\S]*\}/.test(trimmed)
  )
    return 'graphql'

  // Shell / Bash
  if (/^#!\/bin\/(bash|sh|zsh)/m.test(trimmed)) return 'shell'
  if (
    /^(export|alias|source|echo|curl|wget|chmod|sudo|apt|brew|npm|yarn|pnpm|pip)\s/m.test(
      trimmed
    )
  )
    return 'shell'

  // CSS / SCSS
  if (/^\s*(@import|@media|@keyframes|@font-face|:root)\s/m.test(trimmed))
    return 'css'
  if (/^\s*[.#][a-zA-Z][\w-]*\s*\{/m.test(trimmed)) return 'css'
  if (
    /^\s*\$[a-zA-Z]/.test(trimmed) ||
    /^\s*@mixin\s/m.test(trimmed) ||
    /^\s*@include\s/m.test(trimmed)
  )
    return 'scss'

  // Rust
  if (
    /^(use\s+std::|fn\s+main|pub\s+(fn|struct|enum|mod|trait)|impl\s|let\s+mut\s|#\[derive)/m.test(
      trimmed
    )
  )
    return 'rust'

  // Go
  if (/^package\s+\w+/m.test(trimmed) && /^func\s/m.test(trimmed)) return 'go'
  if (/^import\s+"/.test(trimmed) && /^func\s/m.test(trimmed)) return 'go'

  // Python
  if (
    /^(def |class |import |from .+ import |if __name__|print\(|#.*coding)/m.test(
      trimmed
    )
  )
    return 'python'
  if (/^\s*(elif |except |finally:)/m.test(trimmed)) return 'python'

  // Java
  if (/^(package\s+[a-z]|import\s+java\.|public\s+class\s)/m.test(trimmed))
    return 'java'

  // Kotlin
  if (
    /^(fun\s|val\s|var\s|data\s+class|sealed\s+class|object\s)/m.test(
      trimmed
    ) &&
    /:\s*(Int|String|Boolean|List|Map)/m.test(trimmed)
  )
    return 'kotlin'

  // Swift
  if (
    /^(import\s+Foundation|import\s+UIKit|func\s|let\s|var\s|struct\s|class\s|protocol\s)/m.test(
      trimmed
    ) &&
    /->\s/.test(trimmed)
  )
    return 'swift'

  // C#
  if (
    /^(using\s+System|namespace\s|public\s+class|private\s|protected\s)/m.test(
      trimmed
    ) &&
    /;\s*$/.test(trimmed)
  )
    return 'csharp'

  // C++
  if (/^#include\s+[<"]/.test(trimmed)) return 'cpp'
  if (
    /^(std::|cout|cin|endl|namespace\s|template\s*<|class\s+\w+\s*\{)/m.test(
      trimmed
    )
  )
    return 'cpp'

  // PHP
  if (/^<\?php/m.test(trimmed) || /^\$[a-zA-Z_]/.test(trimmed)) return 'php'

  // TypeScript — check before JavaScript since TS is a superset
  if (/^(interface\s+\w+|type\s+\w+\s*=|enum\s+\w+)/m.test(trimmed))
    return 'typescript'
  if (
    /(:\s*(string|number|boolean|void|any|never|unknown)([\[\]|,\s]|\s*[;)={]))/m.test(
      trimmed
    )
  )
    return 'typescript'
  if (/^import\s.*from\s+['"]/.test(trimmed) && /<[A-Z]\w*>/.test(trimmed))
    return 'typescript'

  // JavaScript
  if (
    /^(const|let|var|function|import|export|class|async|await|=>)\s/m.test(
      trimmed
    )
  )
    return 'javascript'
  if (/^(module\.exports|require\()/.test(trimmed)) return 'javascript'

  // YAML fallback (simple key: value)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s/m.test(trimmed) && !/[{};]/.test(trimmed))
    return 'yaml'

  return null
}

// ─── Diff stats type (matches what the worker sends back) ────────────────────
interface DiffStats {
  additions: number
  deletions: number
  unchanged: number
}

// ─── Toast component (local) ─────────────────────────────────────────────────
function DiffToast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-[200] flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border animate-in slide-in-from-top-4 fade-in duration-300',
        'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100'
      )}
    >
      {type === 'success' ? (
        <CheckCircle2 className='w-5 h-5 text-emerald-500 shrink-0' />
      ) : (
        <AlertCircle className='w-5 h-5 text-red-500 shrink-0' />
      )}
      <p className='text-sm font-medium'>{message}</p>
      <button
        onClick={onClose}
        className='ml-2 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors'
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ─── JSON format helper ──────────────────────────────────────────────────────
function tryFormatJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function DiffChecker() {
  const { theme } = useTheme()

  // Content lives in refs — NEVER fed back into DiffEditor props (prevents cursor reset)
  const originalRef = useRef('')
  const modifiedRef = useRef('')

  // Language — fully auto-detected from content
  const languageRef = useRef('plaintext')
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // View state
  const [isInline, setIsInline] = useState(false)

  // hasContent drives button enable/disable — updated from onChange listeners
  const [hasContent, setHasContent] = useState(false)

  // Diff stats (computed live)
  const [stats, setStats] = useState<DiffStats>({
    additions: 0,
    deletions: 0,
    unchanged: 0,
  })

  // Save/load state
  const [isSaving, setIsSaving] = useState(false)
  const [currentDiffId, setCurrentDiffId] = useState<number | null>(null)
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  // Monaco refs
  const monacoRef = useRef<any>(null)
  const diffEditorRef = useRef<any>(null)
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Web Worker for diff computation (runs off main thread)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // Create worker on mount
    workerRef.current = new Worker(new URL('./diff-worker.ts', import.meta.url))
    workerRef.current.onmessage = (e: MessageEvent<DiffStats>) => {
      setStats(e.data)
    }

    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // ─── Resolve Monaco theme name ──────────────────────────────────────
  const monacoTheme = theme === 'dark' ? 'rock-dark' : 'rock-light'

  // ─── Define themes & disable diagnostics BEFORE mount ───────────────
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monaco.editor.defineTheme('rock-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#09090b',
        'editor.lineHighlightBackground': '#18181b',
      },
    })
    monaco.editor.defineTheme('rock-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f4f4f5',
      },
    })

    // Disable all built-in diagnostics / LSP validation
    monaco.languages.json?.jsonDefaults?.setDiagnosticsOptions?.({
      validate: false,
      allowComments: true,
      trailingCommas: 'ignore',
    })
    monaco.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions?.({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    })
    monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions?.({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    })
    monaco.languages.css?.cssDefaults?.setDiagnosticsOptions?.({
      validate: false,
    })
  }, [])

  // ─── Sync theme when user toggles dark/light ───────────────────────
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(monacoTheme)
    }
  }, [monacoTheme])

  // ─── Apply language to Monaco models ────────────────────────────────
  const applyLanguage = useCallback((lang: string) => {
    if (!diffEditorRef.current || !monacoRef.current) return
    const monaco = monacoRef.current
    const origModel = diffEditorRef.current.getOriginalEditor().getModel()
    const modModel = diffEditorRef.current.getModifiedEditor().getModel()
    if (origModel) monaco.editor.setModelLanguage(origModel, lang)
    if (modModel) monaco.editor.setModelLanguage(modModel, lang)
  }, [])

  // ─── Auto-detect language from content ──────────────────────────────
  const autoDetectLanguage = useCallback(
    (orig: string, mod: string) => {
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current)
      detectTimerRef.current = setTimeout(() => {
        // Use the longer text for better detection accuracy
        const sample = orig.length >= mod.length ? orig : mod
        const detected = detectLanguage(sample)
        if (detected && detected !== languageRef.current) {
          languageRef.current = detected
          applyLanguage(detected)
        }
      }, 300)
    },
    [applyLanguage]
  )

  // ─── Debounced stats recomputation (via Web Worker) ─────────────────
  const recomputeStats = useCallback(
    (orig: string, mod: string) => {
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
      // Adaptive debounce: longer delay for larger content
      const charCount = orig.length + mod.length
      const delay = charCount > 200_000 ? 500 : charCount > 50_000 ? 300 : 150
      statsTimerRef.current = setTimeout(() => {
        setHasContent(!!(orig.trim() || mod.trim()))
        workerRef.current?.postMessage({ original: orig, modified: mod })
      }, delay)
      autoDetectLanguage(orig, mod)
    },
    [autoDetectLanguage]
  )

  // ─── DiffEditor mount — attach change listeners ────────────────────
  const handleDiffEditorMount = useCallback(
    (editor: any, monaco: any) => {
      diffEditorRef.current = editor
      monacoRef.current = monaco

      // Set initial language on both models
      const origModel = editor.getOriginalEditor().getModel()
      const modModel = editor.getModifiedEditor().getModel()
      if (origModel)
        monaco.editor.setModelLanguage(origModel, languageRef.current)
      if (modModel)
        monaco.editor.setModelLanguage(modModel, languageRef.current)

      // Apply custom theme
      monaco.editor.setTheme(monacoTheme)

      const origEditor = editor.getOriginalEditor()
      const modEditor = editor.getModifiedEditor()

      // Listen for changes on original (left) side
      origEditor.onDidChangeModelContent(() => {
        const val = origEditor.getValue()
        originalRef.current = val
        recomputeStats(val, modifiedRef.current)
      })

      // Listen for changes on modified (right) side
      modEditor.onDidChangeModelContent(() => {
        const val = modEditor.getValue()
        modifiedRef.current = val
        recomputeStats(originalRef.current, val)
      })
    },
    [monacoTheme, recomputeStats]
  )

  // ─── Actions ────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    const editor = diffEditorRef.current
    if (editor) {
      editor.getOriginalEditor().setValue('')
      editor.getModifiedEditor().setValue('')
    }
    originalRef.current = ''
    modifiedRef.current = ''
    setHasContent(false)
    setStats({ additions: 0, deletions: 0, unchanged: 0 })
    setCurrentDiffId(null)
    languageRef.current = 'plaintext'
    applyLanguage('plaintext')
  }, [applyLanguage])

  const handleSwap = useCallback(() => {
    const editor = diffEditorRef.current
    if (editor) {
      const origVal = editor.getOriginalEditor().getValue()
      const modVal = editor.getModifiedEditor().getValue()
      editor.getOriginalEditor().setValue(modVal)
      editor.getModifiedEditor().setValue(origVal)
    }
  }, [])

  const handleFormatBoth = useCallback(() => {
    if (languageRef.current !== 'json') return
    const editor = diffEditorRef.current
    if (editor) {
      const origFormatted = tryFormatJson(editor.getOriginalEditor().getValue())
      const modFormatted = tryFormatJson(editor.getModifiedEditor().getValue())
      editor.getOriginalEditor().setValue(origFormatted)
      editor.getModifiedEditor().setValue(modFormatted)
    }
  }, [])

  const handleSave = useCallback(async () => {
    const orig = originalRef.current
    const mod = modifiedRef.current

    if (!orig.trim() && !mod.trim()) {
      setToast({
        message: 'Nothing to save — both panes are empty.',
        type: 'error',
      })
      return
    }

    setIsSaving(true)
    try {
      const now = Date.now()
      const name = `Diff — ${new Date(now).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`

      if (currentDiffId) {
        await updateDiff(currentDiffId, {
          original: orig,
          modified: mod,
        })
        setToast({ message: 'Comparison updated!', type: 'success' })
      } else {
        const id = await saveDiff({
          name,
          original: orig,
          modified: mod,
          createdAt: now,
          updatedAt: now,
        })
        setCurrentDiffId(id)
        setToast({ message: 'Comparison saved locally!', type: 'success' })
      }
    } catch (e) {
      console.error('Save failed:', e)
      setToast({ message: 'Failed to save comparison.', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }, [currentDiffId])

  const handleLoadDiff = useCallback((diff: DiffRecord) => {
    const editor = diffEditorRef.current
    if (editor) {
      editor.getOriginalEditor().setValue(diff.original)
      editor.getModifiedEditor().setValue(diff.modified)
    }
    originalRef.current = diff.original
    modifiedRef.current = diff.modified
    setHasContent(!!(diff.original.trim() || diff.modified.trim()))
    setCurrentDiffId(diff.id ?? null)
  }, [])

  // ─── Shared Monaco options ─────────────────────────────────────────
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontFamily: 'Geist Mono, monospace',
    padding: { top: 16, bottom: 16 },
    scrollbar: {
      vertical: 'visible' as const,
      horizontal: 'auto' as const,
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    hover: { enabled: false },
    wordWrap: 'off' as const,
  }

  const hasChanges = stats.additions > 0 || stats.deletions > 0

  return (
    <div className='h-screen flex flex-col bg-white dark:bg-zinc-950 transition-colors'>
      <DiffHeader isSaving={isSaving} />

      {/* Toolbar */}
      <div className='shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50'>
        <div className='flex items-center justify-between px-3 lg:px-6 py-2 gap-2 overflow-x-auto'>
          {/* Left: Actions */}
          <div className='flex items-center gap-2 shrink-0'>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasContent}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all',
                hasContent
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-900/20 active:scale-[0.97]'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
              )}
              title={
                currentDiffId
                  ? 'Update saved comparison'
                  : 'Save comparison to browser'
              }
              id='btn-save'
            >
              <Save size={15} />
              <span className='hidden sm:inline'>
                {currentDiffId ? 'Update' : 'Save'}
              </span>
            </button>

            {/* Load */}
            <button
              onClick={() => setShowSavedModal(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700',
                'text-zinc-700 dark:text-zinc-300 hover:border-emerald-300 dark:hover:border-emerald-700',
                'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              )}
              title='Load saved comparison'
              id='btn-load'
            >
              <FolderOpen size={15} />
              <span className='hidden sm:inline'>Load</span>
            </button>

            <div className='h-5 w-px bg-zinc-200 dark:bg-zinc-700 mx-0.5 hidden sm:block' />

            {/* Swap */}
            <button
              onClick={handleSwap}
              disabled={!hasContent}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all',
                'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
              title='Swap left ↔ right'
              id='btn-swap'
            >
              <ArrowRightLeft size={15} />
              <span className='hidden lg:inline'>Swap</span>
            </button>

            {/* Format (always shown — handler checks if content is JSON) */}
            <button
              onClick={handleFormatBoth}
              disabled={!hasContent}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all',
                'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
              title='Format JSON'
              id='btn-format'
            >
              <WrapText size={15} />
              <span className='hidden lg:inline'>Format</span>
            </button>

            {/* Clear */}
            <button
              onClick={handleClear}
              disabled={!hasContent}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all',
                'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
              title='Clear both editors'
              id='btn-clear'
            >
              <Eraser size={15} />
              <span className='hidden lg:inline'>Clear</span>
            </button>
          </div>

          {/* Right: Language + Stats + View toggle */}
          <div className='flex items-center gap-2 shrink-0'>
            {/* Stats badges */}
            {hasChanges && (
              <div className='hidden sm:flex items-center gap-1.5 mr-1'>
                <span className='inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'>
                  <Plus size={12} />
                  {stats.additions}
                </span>
                <span className='inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'>
                  <Minus size={12} />
                  {stats.deletions}
                </span>
                <span className='inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'>
                  <Equal size={12} />
                  {stats.unchanged}
                </span>
              </div>
            )}

            {/* Inline / Side-by-side toggle */}
            <div className='flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden'>
              <button
                onClick={() => setIsInline(false)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all',
                  !isInline
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
                title='Side by side'
              >
                <Columns2 size={14} />
                <span className='hidden md:inline'>Side by Side</span>
              </button>
              <button
                onClick={() => setIsInline(true)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all',
                  isInline
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
                title='Inline'
              >
                <Rows2 size={14} />
                <span className='hidden md:inline'>Inline</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DiffEditor (always visible, always editable) ────────────── */}
      {/* IMPORTANT: original="" and modified="" are initial values only.
          Content is managed via editor instances (refs) — never fed back
          as props, which would cause cursor-reset on every keystroke. */}
      <div className='flex-1 min-h-0 diff-editor-container'>
        <DiffEditor
          height='100%'
          language='plaintext'
          original=''
          modified=''
          theme={monacoTheme}
          beforeMount={handleBeforeMount}
          onMount={handleDiffEditorMount}
          options={{
            ...editorOptions,
            readOnly: false,
            originalEditable: true,
            renderSideBySide: !isInline,
            enableSplitViewResizing: true,
            ignoreTrimWhitespace: false,
            renderIndicators: true,
            renderMarginRevertIcon: false,
            diffWordWrap: 'off',
          }}
        />
      </div>

      {/* Mobile stats bar */}
      {hasChanges && (
        <div className='shrink-0 flex sm:hidden items-center justify-center gap-2 px-4 py-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50'>
          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'>
            <Plus size={10} />
            {stats.additions}
          </span>
          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'>
            <Minus size={10} />
            {stats.deletions}
          </span>
          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'>
            <Equal size={10} />
            {stats.unchanged}
          </span>
        </div>
      )}

      {/* Saved diffs modal */}
      <SavedDiffsModal
        isOpen={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        onLoad={handleLoadDiff}
      />

      {/* Toast */}
      {toast && (
        <DiffToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
