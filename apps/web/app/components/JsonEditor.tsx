import React from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { editor } from 'monaco-editor'

interface JsonEditorProps {
  defaultValue?: string
  remoteValue?: { code: string; nonce: number } | null
  onChange: (value: string | undefined) => void
  onReady?: () => void
  onValidate?: (markers: any[]) => void
  readOnly?: boolean
  /** Show wrap toggle. Defaults to true for editable editors (left input). */
  showWrapToggle?: boolean
  /** Show control to collapse the left JSON editor pane. */
  showSidebarToggle?: boolean
  isSidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  className?: string
  options?: editor.IStandaloneEditorConstructionOptions
  language?: string
  onFileDrop?: (file: File) => Promise<void>
  slug?: string | null
}

import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { UploadCloud, Download, WrapText, PanelLeft } from 'lucide-react'

const WORD_WRAP_STORAGE_KEY = 'jsonrock_editor_word_wrap'
const WORD_WRAP_CHANGE_EVENT = 'jsonrock-word-wrap-change'

function readWordWrapPreference(): boolean {
  try {
    return localStorage.getItem(WORD_WRAP_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeWordWrapPreference(enabled: boolean) {
  try {
    localStorage.setItem(WORD_WRAP_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Ignore quota / private-mode failures — preference just won't persist.
  }
  window.dispatchEvent(new Event(WORD_WRAP_CHANGE_EVENT))
}

/** Monaco throws if touched after dispose — never let that crash the app. */
function withLiveEditor(
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>,
  fn: (ed: editor.IStandaloneCodeEditor) => void
) {
  const ed = editorRef.current
  if (!ed) return
  try {
    // getModel() is null after dispose
    if (!ed.getModel()) return
    fn(ed)
  } catch {
    // InstantiationService disposed / domNode gone — drop the stale ref
    editorRef.current = null
  }
}

const handleJsonDownload = async (
  content: string,
  requestedFilename: string
) => {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: requestedFilename,
        types: [
          {
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error(err)
    return
  }
  // Fallback
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = requestedFilename
  a.click()
  URL.revokeObjectURL(url)
}

const JsonEditor: React.FC<JsonEditorProps> = ({
  defaultValue,
  remoteValue,
  onChange,
  onReady,
  onValidate,
  readOnly = false,
  showWrapToggle,
  showSidebarToggle = false,
  onToggleSidebar,
  className,
  options: customOptions,
  language = 'json',
  onFileDrop,
  slug,
}) => {
  const { theme } = useTheme()
  const [isDragOver, setIsDragOver] = React.useState(false)
  // Default off to match current horizontal-scroll behavior; hydrate from localStorage after mount.
  const [wordWrapEnabled, setWordWrapEnabled] = React.useState(false)
  const editorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = React.useRef<typeof import('monaco-editor') | null>(null)
  const isRemoteUpdate = React.useRef(false) // Flag to prevent loop
  const mountedRef = React.useRef(true)
  const canShowWrapToggle = showWrapToggle ?? !readOnly
  const showToolbar = showSidebarToggle || canShowWrapToggle || !readOnly

  const toolbarBtnClass = (opts?: { active?: boolean; disabled?: boolean }) =>
    cn(
      'inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors',
      opts?.disabled
        ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
        : opts?.active
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer'
    )

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
    if (file && onFileDrop) {
      await onFileDrop(file)
    }
  }

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      editorRef.current = null
      monacoRef.current = null
    }
  }, [])

  const handleEditorDidMount: OnMount = (ed, monaco) => {
    if (!mountedRef.current) return
    editorRef.current = ed
    monacoRef.current = monaco

    // Define Dark Theme
    monaco.editor.defineTheme('rock-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#09090b', // zinc-950
        'editor.lineHighlightBackground': '#18181b',
      },
    })

    // Define Light Theme
    monaco.editor.defineTheme('rock-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f4f4f5', // zinc-100
      },
    })

    // Initial Set
    const currentTheme = theme === 'dark' ? 'rock-dark' : 'rock-light'
    try {
      monaco.editor.setTheme(currentTheme)
      ed.updateOptions({
        wordWrap: readWordWrapPreference() ? 'on' : 'off',
      })
    } catch {
      // ignore theme/options failures during teardown races
    }

    // Notify parent that editor is fully ready
    onReady?.()
  }

  // Hydrate wrap preference + keep multiple JsonEditor instances in sync
  React.useEffect(() => {
    setWordWrapEnabled(readWordWrapPreference())

    const syncWrapPreference = () => {
      setWordWrapEnabled(readWordWrapPreference())
    }

    window.addEventListener(WORD_WRAP_CHANGE_EVENT, syncWrapPreference)
    window.addEventListener('storage', syncWrapPreference)
    return () => {
      window.removeEventListener(WORD_WRAP_CHANGE_EVENT, syncWrapPreference)
      window.removeEventListener('storage', syncWrapPreference)
    }
  }, [])

  React.useEffect(() => {
    withLiveEditor(editorRef, (ed) => {
      ed.updateOptions({
        wordWrap: wordWrapEnabled ? 'on' : 'off',
      })
    })
  }, [wordWrapEnabled])

  const toggleWordWrap = () => {
    const next = !wordWrapEnabled
    setWordWrapEnabled(next)
    writeWordWrapPreference(next)
    withLiveEditor(editorRef, (ed) => {
      ed.updateOptions({
        wordWrap: next ? 'on' : 'off',
      })
    })
  }

  // React to theme changes
  React.useEffect(() => {
    if (!monacoRef.current) return
    try {
      const currentTheme = theme === 'dark' ? 'rock-dark' : 'rock-light'
      monacoRef.current.editor.setTheme(currentTheme)
    } catch {
      monacoRef.current = null
    }
  }, [theme])

  // React to remote value changes (Socket or Formatter)
  // Depend on primitives so a new object identity alone does not re-run this.
  const remoteCode = remoteValue?.code
  const remoteNonce = remoteValue?.nonce
  React.useEffect(() => {
    if (remoteCode == null) return
    withLiveEditor(editorRef, (ed) => {
      const currentValue = ed.getValue()
      if (currentValue === remoteCode) return
      isRemoteUpdate.current = true
      ed.setValue(remoteCode)
      isRemoteUpdate.current = false
    })
  }, [remoteCode, remoteNonce])

  const handleEditorChange = (value: string | undefined) => {
    // If this change was triggered by our own remote update logic, ignore it
    if (isRemoteUpdate.current) return
    onChange(value)
  }

  const editorOptions = React.useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly,
      fontFamily: 'Geist Mono, monospace',
      padding: { top: 16, bottom: 16 },
      scrollbar: {
        vertical: 'visible',
        horizontal: 'auto',
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        verticalHasArrows: false,
        horizontalHasArrows: false,
      },
      hover: {
        enabled: false,
      },
      ...customOptions,
      // Preference wins over any caller override so both panes stay in sync
      wordWrap: wordWrapEnabled ? 'on' : 'off',
    }),
    [readOnly, customOptions, wordWrapEnabled]
  )

  return (
    <div
      className={cn(
        'h-full w-full overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-inner relative transition-colors duration-200 flex flex-col',
        isDragOver ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : '',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className='absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-[2px] pointer-events-none border-4 border-dashed border-emerald-500/50 rounded-xl animate-in fade-in duration-200 text-center p-4'>
          <div className='p-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4'>
            <UploadCloud
              size={48}
              className='text-emerald-600 dark:text-emerald-400'
            />
          </div>
          <p className='text-xl font-bold text-emerald-700 dark:text-emerald-300'>
            Drop your JSON file here
          </p>
          <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-2'>
            to instantly upload and share
          </p>
        </div>
      )}

      {showToolbar && (
        <div
          className={cn(
            'shrink-0 h-9 px-2 flex items-center justify-between gap-2',
            'border-b border-zinc-200 dark:border-zinc-800',
            'bg-zinc-50/95 dark:bg-zinc-900/90'
          )}
        >
          <div className='flex items-center gap-0.5'>
            {showSidebarToggle && onToggleSidebar && (
              <button
                type='button'
                onClick={onToggleSidebar}
                title='Collapse JSON editor'
                aria-label='Collapse JSON editor'
                className={toolbarBtnClass()}
              >
                <PanelLeft size={15} />
              </button>
            )}
          </div>

          <div className='flex items-center gap-0.5'>
            {canShowWrapToggle && (
              <button
                type='button'
                onClick={toggleWordWrap}
                aria-pressed={wordWrapEnabled}
                title={
                  wordWrapEnabled ? 'Disable line wrap' : 'Enable line wrap'
                }
                aria-label={
                  wordWrapEnabled ? 'Disable line wrap' : 'Enable line wrap'
                }
                className={toolbarBtnClass({ active: wordWrapEnabled })}
              >
                <WrapText size={14} />
              </button>
            )}

            {!readOnly && (
              <button
                type='button'
                onClick={() => {
                  withLiveEditor(editorRef, (ed) => {
                    if (!slug) return
                    void handleJsonDownload(ed.getValue(), 'document.json')
                  })
                }}
                disabled={!slug}
                title={
                  !slug
                    ? 'Save or create document first to download'
                    : 'Download JSON'
                }
                aria-label={
                  !slug
                    ? 'Download JSON (disabled — save document first)'
                    : 'Download JSON'
                }
                className={toolbarBtnClass({ disabled: !slug })}
              >
                <Download size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className='flex-1 min-h-0 relative'>
        <Editor
          height='100%'
          defaultLanguage='json'
          language={language}
          defaultValue={defaultValue}
          onChange={handleEditorChange}
          onValidate={onValidate}
          // Default theme prop is initial only, effect handles updates
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={editorOptions}
          onMount={handleEditorDidMount}
          keepCurrentModel
        />
      </div>
    </div>
  )
}

export default JsonEditor
