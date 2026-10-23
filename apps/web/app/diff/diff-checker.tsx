'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { DiffEditor, type BeforeMount } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import {
  ArrowRightLeft,
  Save,
  FolderOpen,
  Eraser,
  Braces,
  Plus,
  Minus,
  Equal,
  AlertCircle,
  CheckCircle2,
  X,
  GitCompareArrows,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveDiff, updateDiff, type DiffRecord } from '@/lib/diff-db'
import { Button } from '../components/ui/button'
import { Pill } from '../components/ui/pill'
import { SegmentedControl } from '../components/ui/segmented-control'
import DiffHeader from './diff-header'
import SavedDiffsModal from './saved-diffs-modal'
import type { DiffStatsResult } from './diff-worker'

// ─── Language auto-detection ──────────────────────────────────────────────────
function detectLanguage(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  if (/^[\[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // might still be JSON-like
    }
  }

  if (
    /^<(!DOCTYPE|html|head|body|div|span|p|a|script|style|link|meta|section|header|footer|main|nav|table|form|ul|ol|li|h[1-6])/i.test(
      trimmed
    )
  )
    return 'html'
  if (/<\/?[a-z][a-z0-9]*[\s>]/i.test(trimmed) && /<\/[a-z]/i.test(trimmed))
    return 'html'

  if (/^<\?xml/i.test(trimmed)) return 'xml'

  if (
    /^FROM\s+\S+/m.test(trimmed) &&
    /^(RUN|CMD|COPY|ADD|ENV|EXPOSE|WORKDIR|ENTRYPOINT)\s/m.test(trimmed)
  )
    return 'dockerfile'

  if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s/m.test(trimmed) && /^\s*-\s/m.test(trimmed))
    return 'yaml'
  if (/^---\s*$/m.test(trimmed)) return 'yaml'

  if (
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\s/im.test(
      trimmed
    )
  )
    return 'sql'

  if (
    /^#{1,6}\s/m.test(trimmed) &&
    (/\[.*\]\(.*\)/.test(trimmed) ||
      /^```/m.test(trimmed) ||
      /^\*\*/.test(trimmed))
  )
    return 'markdown'

  if (
    /^(type|query|mutation|subscription|fragment|schema|input|enum|interface|union)\s/m.test(
      trimmed
    ) &&
    /\{[\s\S]*\}/.test(trimmed)
  )
    return 'graphql'

  if (/^#!\/bin\/(bash|sh|zsh)/m.test(trimmed)) return 'shell'
  if (
    /^(export|alias|source|echo|curl|wget|chmod|sudo|apt|brew|npm|yarn|pnpm|pip)\s/m.test(
      trimmed
    )
  )
    return 'shell'

  if (/^\s*(@import|@media|@keyframes|@font-face|:root)\s/m.test(trimmed))
    return 'css'
  if (/^\s*[.#][a-zA-Z][\w-]*\s*\{/m.test(trimmed)) return 'css'
  if (
    /^\s*\$[a-zA-Z]/.test(trimmed) ||
    /^\s*@mixin\s/m.test(trimmed) ||
    /^\s*@include\s/m.test(trimmed)
  )
    return 'scss'

  if (
    /^(use\s+std::|fn\s+main|pub\s+(fn|struct|enum|mod|trait)|impl\s|let\s+mut\s|#\[derive)/m.test(
      trimmed
    )
  )
    return 'rust'

  if (/^package\s+\w+/m.test(trimmed) && /^func\s/m.test(trimmed)) return 'go'
  if (/^import\s+"/.test(trimmed) && /^func\s/m.test(trimmed)) return 'go'

  if (
    /^(def |class |import |from .+ import |if __name__|print\(|#.*coding)/m.test(
      trimmed
    )
  )
    return 'python'
  if (/^\s*(elif |except |finally:)/m.test(trimmed)) return 'python'

  if (/^(package\s+[a-z]|import\s+java\.|public\s+class\s)/m.test(trimmed))
    return 'java'

  if (
    /^(fun\s|val\s|var\s|data\s+class|sealed\s+class|object\s)/m.test(
      trimmed
    ) &&
    /:\s*(Int|String|Boolean|List|Map)/m.test(trimmed)
  )
    return 'kotlin'

  if (
    /^(import\s+Foundation|import\s+UIKit|func\s|let\s|var\s|struct\s|class\s|protocol\s)/m.test(
      trimmed
    ) &&
    /->\s/.test(trimmed)
  )
    return 'swift'

  if (
    /^(using\s+System|namespace\s|public\s+class|private\s|protected\s)/m.test(
      trimmed
    ) &&
    /;\s*$/.test(trimmed)
  )
    return 'csharp'

  if (/^#include\s+[<"]/.test(trimmed)) return 'cpp'
  if (
    /^(std::|cout|cin|endl|namespace\s|template\s*<|class\s+\w+\s*\{)/m.test(
      trimmed
    )
  )
    return 'cpp'

  if (/^<\?php/m.test(trimmed) || /^\$[a-zA-Z_]/.test(trimmed)) return 'php'

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

  if (
    /^(const|let|var|function|import|export|class|async|await|=>)\s/m.test(
      trimmed
    )
  )
    return 'javascript'
  if (/^(module\.exports|require\()/.test(trimmed)) return 'javascript'

  if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s/m.test(trimmed) && !/[{};]/.test(trimmed))
    return 'yaml'

  return null
}

interface DiffStats {
  additions: number
  deletions: number
  unchanged: number
  approximate: boolean
}

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
      role='status'
      className={cn(
        'fixed top-4 right-4 z-[200] flex items-center gap-3 rounded-[10px] border px-4 py-3 shadow-xl animate-in slide-in-from-top-4 fade-in duration-300',
        'border-[var(--jr-border)] bg-[var(--jr-surface)] text-[var(--jr-text)]'
      )}
    >
      {type === 'success' ? (
        <CheckCircle2 className='h-5 w-5 shrink-0 text-[var(--jr-accent)]' />
      ) : (
        <AlertCircle className='h-5 w-5 shrink-0 text-[var(--jr-danger)]' />
      )}
      <p className='text-sm font-medium'>{message}</p>
      <button
        type='button'
        onClick={onClose}
        className='ml-2 rounded-md p-1 text-[var(--jr-muted)] transition-colors hover:text-[var(--jr-text)]'
        aria-label='Dismiss'
      >
        <X size={16} />
      </button>
    </div>
  )
}

function tryFormatJson(value: string): { formatted: string; ok: boolean } {
  const trimmed = value.trim()
  if (!trimmed) return { formatted: value, ok: false }
  try {
    return {
      formatted: JSON.stringify(JSON.parse(trimmed), null, 2),
      ok: true,
    }
  } catch {
    return { formatted: value, ok: false }
  }
}

const LANG_LABEL: Record<string, string> = {
  plaintext: 'Text',
  json: 'JSON',
  javascript: 'JS',
  typescript: 'TS',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  markdown: 'MD',
  yaml: 'YAML',
  xml: 'XML',
  python: 'Python',
  sql: 'SQL',
  shell: 'Shell',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  graphql: 'GraphQL',
  dockerfile: 'Docker',
}

type ViewMode = 'side' | 'inline'

export default function DiffChecker() {
  const { theme } = useTheme()

  const originalRef = useRef('')
  const modifiedRef = useRef('')
  const languageRef = useRef('plaintext')
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statsReqIdRef = useRef(0)

  const [viewMode, setViewMode] = useState<ViewMode>('side')
  const [hasContent, setHasContent] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState('plaintext')
  const [stats, setStats] = useState<DiffStats>({
    additions: 0,
    deletions: 0,
    unchanged: 0,
    approximate: false,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [currentDiffId, setCurrentDiffId] = useState<number | null>(null)
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const monacoRef = useRef<any>(null)
  const diffEditorRef = useRef<any>(null)
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    workerRef.current = new Worker(new URL('./diff-worker.ts', import.meta.url))
    workerRef.current.onmessage = (e: MessageEvent<DiffStatsResult>) => {
      const data = e.data
      if (data.id !== statsReqIdRef.current) return
      setStats({
        additions: data.additions,
        deletions: data.deletions,
        unchanged: data.unchanged,
        approximate: data.approximate,
      })
    }

    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const monacoTheme = theme === 'dark' ? 'rock-dark' : 'rock-light'

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
        'editor.lineHighlightBackground': '#f8fafc',
      },
    })

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

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(monacoTheme)
    }
  }, [monacoTheme])

  const applyLanguage = useCallback((lang: string) => {
    if (!diffEditorRef.current || !monacoRef.current) return
    const monaco = monacoRef.current
    const origModel = diffEditorRef.current.getOriginalEditor().getModel()
    const modModel = diffEditorRef.current.getModifiedEditor().getModel()
    if (origModel) monaco.editor.setModelLanguage(origModel, lang)
    if (modModel) monaco.editor.setModelLanguage(modModel, lang)
  }, [])

  const autoDetectLanguage = useCallback(
    (orig: string, mod: string) => {
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current)
      detectTimerRef.current = setTimeout(() => {
        const sample = orig.length >= mod.length ? orig : mod
        const detected = detectLanguage(sample) || 'plaintext'
        if (detected !== languageRef.current) {
          languageRef.current = detected
          setDetectedLanguage(detected)
          applyLanguage(detected)
        } else {
          setDetectedLanguage(detected)
        }
      }, 300)
    },
    [applyLanguage]
  )

  const recomputeStats = useCallback(
    (orig: string, mod: string) => {
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
      const charCount = orig.length + mod.length
      const delay = charCount > 200_000 ? 500 : charCount > 50_000 ? 300 : 150
      statsTimerRef.current = setTimeout(() => {
        setHasContent(!!(orig.trim() || mod.trim()))
        const id = ++statsReqIdRef.current
        workerRef.current?.postMessage({ id, original: orig, modified: mod })
      }, delay)
      autoDetectLanguage(orig, mod)
    },
    [autoDetectLanguage]
  )

  const handleDiffEditorMount = useCallback(
    (editor: any, monaco: any) => {
      diffEditorRef.current = editor
      monacoRef.current = monaco

      const origModel = editor.getOriginalEditor().getModel()
      const modModel = editor.getModifiedEditor().getModel()
      if (origModel)
        monaco.editor.setModelLanguage(origModel, languageRef.current)
      if (modModel)
        monaco.editor.setModelLanguage(modModel, languageRef.current)

      monaco.editor.setTheme(monacoTheme)

      const origEditor = editor.getOriginalEditor()
      const modEditor = editor.getModifiedEditor()

      origEditor.onDidChangeModelContent(() => {
        const val = origEditor.getValue()
        originalRef.current = val
        recomputeStats(val, modifiedRef.current)
      })

      modEditor.onDidChangeModelContent(() => {
        const val = modEditor.getValue()
        modifiedRef.current = val
        recomputeStats(originalRef.current, val)
      })
    },
    [monacoTheme, recomputeStats]
  )

  const handleClear = useCallback(() => {
    const editor = diffEditorRef.current
    if (editor) {
      editor.getOriginalEditor().setValue('')
      editor.getModifiedEditor().setValue('')
    }
    originalRef.current = ''
    modifiedRef.current = ''
    setHasContent(false)
    setStats({ additions: 0, deletions: 0, unchanged: 0, approximate: false })
    setCurrentDiffId(null)
    languageRef.current = 'plaintext'
    setDetectedLanguage('plaintext')
    applyLanguage('plaintext')
  }, [applyLanguage])

  const handleSwap = useCallback(() => {
    const editor = diffEditorRef.current
    if (!editor) return
    const origVal = editor.getOriginalEditor().getValue()
    const modVal = editor.getModifiedEditor().getValue()
    editor.getOriginalEditor().setValue(modVal)
    editor.getModifiedEditor().setValue(origVal)
    originalRef.current = modVal
    modifiedRef.current = origVal
    recomputeStats(modVal, origVal)
  }, [recomputeStats])

  const handleFormatBoth = useCallback(() => {
    const editor = diffEditorRef.current
    if (!editor) return

    const origVal = editor.getOriginalEditor().getValue()
    const modVal = editor.getModifiedEditor().getValue()
    const left = tryFormatJson(origVal)
    const right = tryFormatJson(modVal)

    if (!left.ok && !right.ok) {
      setToast({
        message: 'Format needs valid JSON in at least one pane.',
        type: 'error',
      })
      return
    }

    if (left.ok) editor.getOriginalEditor().setValue(left.formatted)
    if (right.ok) editor.getModifiedEditor().setValue(right.formatted)

    languageRef.current = 'json'
    setDetectedLanguage('json')
    applyLanguage('json')

    const nextOrig = left.ok ? left.formatted : origVal
    const nextMod = right.ok ? right.formatted : modVal
    originalRef.current = nextOrig
    modifiedRef.current = nextMod
    recomputeStats(nextOrig, nextMod)

    setToast({
      message:
        left.ok && right.ok
          ? 'Both panes formatted.'
          : left.ok
            ? 'Left pane formatted.'
            : 'Right pane formatted.',
      type: 'success',
    })
  }, [applyLanguage, recomputeStats])

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
        setToast({ message: 'Comparison updated.', type: 'success' })
      } else {
        const id = await saveDiff({
          name,
          original: orig,
          modified: mod,
          createdAt: now,
          updatedAt: now,
        })
        setCurrentDiffId(id)
        setToast({ message: 'Comparison saved locally.', type: 'success' })
      }
    } catch (e) {
      console.error('Save failed:', e)
      setToast({ message: 'Failed to save comparison.', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }, [currentDiffId])

  const handleLoadDiff = useCallback(
    (diff: DiffRecord) => {
      const editor = diffEditorRef.current
      if (editor) {
        editor.getOriginalEditor().setValue(diff.original)
        editor.getModifiedEditor().setValue(diff.modified)
      }
      originalRef.current = diff.original
      modifiedRef.current = diff.modified
      setHasContent(!!(diff.original.trim() || diff.modified.trim()))
      setCurrentDiffId(diff.id ?? null)
      recomputeStats(diff.original, diff.modified)
    },
    [recomputeStats]
  )

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
  const langLabel =
    LANG_LABEL[detectedLanguage] ?? detectedLanguage.toUpperCase()

  const StatsBadges = ({ compact = false }: { compact?: boolean }) => (
    <div
      className={cn(
        'flex items-center gap-1.5',
        compact ? 'justify-center' : ''
      )}
      title={
        stats.approximate
          ? 'Approximate line counts (very large / divergent files)'
          : 'Line-level change counts'
      }
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-lg font-semibold text-[var(--jr-accent-hover)] bg-[var(--jr-accent-soft)]',
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
        )}
      >
        <Plus size={compact ? 10 : 12} />
        {stats.additions}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-lg font-semibold text-[var(--jr-danger)] bg-[var(--jr-danger-soft)]',
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
        )}
      >
        <Minus size={compact ? 10 : 12} />
        {stats.deletions}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-lg font-semibold text-[var(--jr-text-2)] bg-[var(--jr-hover)]',
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
        )}
      >
        <Equal size={compact ? 10 : 12} />
        {stats.unchanged}
        {stats.approximate ? '~' : ''}
      </span>
    </div>
  )

  return (
    <div
      data-testid='diff-checker'
      className='flex h-screen flex-col bg-[var(--jr-bg)] text-[14px] text-[var(--jr-text)]'
    >
      <DiffHeader isSaving={isSaving} />

      <div className='shrink-0 border-b border-[var(--jr-border)] bg-[var(--jr-surface)]'>
        <div className='flex items-center justify-between gap-3 overflow-x-auto px-4 py-2.5 lg:px-7'>
          <div className='flex shrink-0 items-center gap-1.5'>
            <Button
              size='sm'
              variant='primary'
              onClick={() => void handleSave()}
              disabled={isSaving || !hasContent}
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
            </Button>

            <Button
              size='sm'
              variant='secondary'
              onClick={() => setShowSavedModal(true)}
              title='Load saved comparison'
              id='btn-load'
            >
              <FolderOpen size={15} />
              <span className='hidden sm:inline'>Load</span>
            </Button>

            <div className='mx-1 hidden h-5 w-px bg-[var(--jr-border)] sm:block' />

            <Button
              size='sm'
              variant='ghost'
              onClick={handleSwap}
              disabled={!hasContent}
              title='Swap left ↔ right'
              id='btn-swap'
            >
              <ArrowRightLeft size={15} />
              <span className='hidden lg:inline'>Swap</span>
            </Button>

            <Button
              size='sm'
              variant='ghost'
              onClick={handleFormatBoth}
              disabled={!hasContent}
              title='Pretty-print JSON in either pane'
              id='btn-format'
            >
              <Braces size={15} />
              <span className='hidden lg:inline'>Format</span>
            </Button>

            <Button
              size='sm'
              variant='ghost'
              onClick={handleClear}
              disabled={!hasContent}
              title='Clear both editors'
              id='btn-clear'
            >
              <Eraser size={15} />
              <span className='hidden lg:inline'>Clear</span>
            </Button>
          </div>

          <div className='flex shrink-0 items-center gap-2'>
            {hasContent && detectedLanguage !== 'plaintext' && (
              <Pill tone='accent' className='hidden sm:inline-flex normal-case'>
                {langLabel}
              </Pill>
            )}

            {hasChanges && (
              <div className='mr-1 hidden sm:block'>
                <StatsBadges />
              </div>
            )}

            <SegmentedControl
              ariaLabel='Diff view mode'
              value={viewMode}
              onChange={setViewMode}
              options={[
                {
                  value: 'side',
                  label: 'Side by Side',
                  testId: 'diff-view-side',
                },
                {
                  value: 'inline',
                  label: 'Inline',
                  testId: 'diff-view-inline',
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className='relative min-h-0 flex-1 diff-editor-container'>
        {!hasContent && (
          <div
            className='pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-16'
            aria-hidden
          >
            <div className='flex max-w-md flex-col items-center gap-2 rounded-[14px] border border-dashed border-[var(--jr-border)] bg-[var(--jr-surface)]/90 px-6 py-5 text-center shadow-sm backdrop-blur-sm'>
              <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--jr-accent-soft)] text-[var(--jr-accent-hover)]'>
                <GitCompareArrows size={20} />
              </span>
              <p className='m-0 text-[15px] font-semibold text-[var(--jr-text)]'>
                Compare two versions
              </p>
              <p className='m-0 text-[13px] leading-relaxed text-[var(--jr-muted)]'>
                Paste original on the left and modified on the right. Language
                is detected automatically — use Format for JSON.
              </p>
            </div>
          </div>
        )}
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
            renderSideBySide: viewMode === 'side',
            enableSplitViewResizing: true,
            ignoreTrimWhitespace: false,
            renderIndicators: true,
            renderMarginRevertIcon: false,
            diffWordWrap: 'off',
          }}
        />
      </div>

      {hasChanges && (
        <div className='flex shrink-0 items-center justify-center gap-2 border-t border-[var(--jr-border)] bg-[var(--jr-surface)] px-4 py-1.5 sm:hidden'>
          <StatsBadges compact />
        </div>
      )}

      <SavedDiffsModal
        isOpen={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        onLoad={handleLoadDiff}
      />

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
