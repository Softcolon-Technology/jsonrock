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
  className?: string
  options?: editor.IStandaloneEditorConstructionOptions
  language?: string
  onFileDrop?: (file: File) => Promise<void>
  slug?: string | null
}

import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { UploadCloud, Download, WrapText } from 'lucide-react'

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
  const editorRef = React.useRef<any>(null)
  const monacoRef = React.useRef<any>(null)
  const isRemoteUpdate = React.useRef(false) // Flag to prevent loop
  const canShowWrapToggle = showWrapToggle ?? !readOnly

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

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
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
    monaco.editor.setTheme(currentTheme)

    // Apply persisted wrap preference (state may hydrate after first paint)
    editor.updateOptions({
      wordWrap: readWordWrapPreference() ? 'on' : 'off',
    })

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
    editorRef.current?.updateOptions({
      wordWrap: wordWrapEnabled ? 'on' : 'off',
    })
  }, [wordWrapEnabled])

  const toggleWordWrap = () => {
    const next = !wordWrapEnabled
    setWordWrapEnabled(next)
    writeWordWrapPreference(next)
    editorRef.current?.updateOptions({
      wordWrap: next ? 'on' : 'off',
    })
  }

  // React to theme changes
  React.useEffect(() => {
    if (monacoRef.current) {
      const currentTheme = theme === 'dark' ? 'rock-dark' : 'rock-light'
      monacoRef.current.editor.setTheme(currentTheme)
    }
  }, [theme])

  // React to remote value changes (Socket or Formatter)
  React.useEffect(() => {
    if (remoteValue && editorRef.current) {
      const currentValue = editorRef.current.getValue()
      if (currentValue !== remoteValue.code) {
        // Set flag to ignore the subsequent onChange trigger
        isRemoteUpdate.current = true

        // We use executeEdits to preserve undo stack if possible, or setValue for full replace
        // For formatter, setValue is usually cleaner as it's a full transform
        editorRef.current.setValue(remoteValue.code)

        // Reset flag immediately (synchronous)
        isRemoteUpdate.current = false
      }
    }
  }, [remoteValue])

  const handleEditorChange = (value: string | undefined, event: any) => {
    // If this change was triggered by our own remote update logic, ignore it
    if (isRemoteUpdate.current) return

    onChange(value)
  }

  return (
    <div
      className={cn(
        'h-full w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-inner relative transition-colors duration-200',
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

      {(canShowWrapToggle || !readOnly) && (
        <div className='absolute top-1 right-2.5 z-10 flex items-center gap-1'>
          {canShowWrapToggle && (
            <button
              type='button'
              onClick={toggleWordWrap}
              aria-pressed={wordWrapEnabled}
              title={wordWrapEnabled ? 'Disable line wrap' : 'Enable line wrap'}
              aria-label={
                wordWrapEnabled ? 'Disable line wrap' : 'Enable line wrap'
              }
              className={cn(
                'p-1 backdrop-blur-md border rounded-lg shadow-sm transition-colors cursor-pointer',
                wordWrapEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  : 'bg-white/90 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-500 hover:shadow'
              )}
            >
              <WrapText size={14} />
            </button>
          )}

          {!readOnly && (
            <button
              type='button'
              onClick={() => {
                if (editorRef.current && slug) {
                  handleJsonDownload(
                    editorRef.current.getValue(),
                    'document.json'
                  )
                }
              }}
              disabled={!slug}
              title={
                !slug
                  ? 'Save or create document first to download'
                  : 'Download JSON'
              }
              className={cn(
                'p-1 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm transition-colors',
                !slug
                  ? 'bg-white/50 dark:bg-zinc-900/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                  : 'bg-white/90 dark:bg-zinc-900/90 hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-500 hover:shadow cursor-pointer'
              )}
            >
              <Download size={14} />
            </button>
          )}
        </div>
      )}

      <Editor
        height='100%'
        defaultLanguage='json'
        language={language}
        defaultValue={defaultValue}
        onChange={handleEditorChange}
        onValidate={onValidate}
        // Default theme prop is initial only, effect handles updates
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={{
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
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  )
}

export default JsonEditor
