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
  className?: string
  options?: editor.IStandaloneEditorConstructionOptions
  language?: string
  onFileDrop?: (file: File) => Promise<void>
  slug?: string | null
}

import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { UploadCloud, Download } from 'lucide-react'

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
  className,
  options: customOptions,
  language = 'json',
  onFileDrop,
  slug,
}) => {
  const { theme } = useTheme()
  const [isDragOver, setIsDragOver] = React.useState(false)
  const editorRef = React.useRef<any>(null)
  const monacoRef = React.useRef<any>(null)
  const isRemoteUpdate = React.useRef(false) // Flag to prevent loop

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
    monaco.editor.defineTheme('cracker-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#09090b', // zinc-950
        'editor.lineHighlightBackground': '#18181b',
      },
    })

    // Define Light Theme
    monaco.editor.defineTheme('cracker-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f4f4f5', // zinc-100
      },
    })

    // Initial Set
    const currentTheme = theme === 'dark' ? 'cracker-dark' : 'cracker-light'
    monaco.editor.setTheme(currentTheme)

    // Notify parent that editor is fully ready
    onReady?.()
  }

  // React to theme changes
  React.useEffect(() => {
    if (monacoRef.current) {
      const currentTheme = theme === 'dark' ? 'cracker-dark' : 'cracker-light'
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

      <button
        onClick={() => {
          if (editorRef.current && slug) {
            handleJsonDownload(editorRef.current.getValue(), 'document.json')
          }
        }}
        disabled={!slug}
        title={
          !slug ? 'Save or create document first to download' : 'Download JSON'
        }
        className={cn(
          'absolute top-1 right-2.5 z-10 p-1 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm transition-colors',
          !slug
            ? 'bg-white/50 dark:bg-zinc-900/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
            : 'bg-white/90 dark:bg-zinc-900/90 hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-500 hover:shadow cursor-pointer'
        )}
      >
        <Download size={14} />
      </button>

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
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  )
}

export default JsonEditor
