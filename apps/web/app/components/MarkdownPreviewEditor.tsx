'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Link as TiptapLink } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Check,
  X,
  Underline,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Split YAML front matter so TipTap edits only the markdown body. */
export function splitMarkdownFrontMatter(content: string): {
  prefix: string
  body: string
} {
  if (!content.startsWith('---')) {
    return { prefix: '', body: content }
  }
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  if (!match) {
    return { prefix: '', body: content }
  }
  return { prefix: match[0], body: content.slice(match[0].length) }
}

function normalizeMarkdown(md: string): string {
  return md.replace(/\r\n/g, '\n').replace(/\n+$/, '')
}

/** TipTap preserves blank paragraphs as &nbsp; — strip those for clean source. */
function sanitizeSerializedMarkdown(md: string): string {
  return md
    .replace(/\u00a0/g, '')
    .replace(/(^|\n)[ \t]*&nbsp;[ \t]*(?=\n|$)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n')
}

const toolbarBtnClass = (active?: boolean, disabled?: boolean) =>
  cn(
    'inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors',
    disabled
      ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
      : active
        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer'
  )

function PreviewFormatToolbar({ editor }: { editor: Editor }) {
  const [, setTick] = useState(0)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])

  useEffect(() => {
    if (linkOpen) {
      const existing = editor.getAttributes('link').href as string | undefined
      setLinkUrl(existing || 'https://')
      requestAnimationFrame(() => linkInputRef.current?.select())
    }
  }, [linkOpen, editor])

  const applyLink = useCallback(() => {
    const href = linkUrl.trim()
    if (!href || href === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setLinkOpen(false)
  }, [editor, linkUrl])

  return (
    <div className='flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 shrink-0 relative'>
      <button
        type='button'
        title='Bold (⌘/Ctrl+B)'
        aria-label='Bold'
        className={toolbarBtnClass(editor.isActive('bold'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </button>
      <button
        type='button'
        title='Italic (⌘/Ctrl+I)'
        aria-label='Italic'
        className={toolbarBtnClass(editor.isActive('italic'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </button>
      <button
        type='button'
        title='Underline (⌘/Ctrl+U)'
        aria-label='Underline'
        className={toolbarBtnClass(editor.isActive('underline'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline size={14} />
      </button>
      <button
        type='button'
        title='Strikethrough'
        aria-label='Strikethrough'
        className={toolbarBtnClass(editor.isActive('strike'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={14} />
      </button>

      <div className='w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1' />

      <button
        type='button'
        title='Heading 1'
        aria-label='Heading 1'
        className={toolbarBtnClass(editor.isActive('heading', { level: 1 }))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={14} />
      </button>
      <button
        type='button'
        title='Heading 2'
        aria-label='Heading 2'
        className={toolbarBtnClass(editor.isActive('heading', { level: 2 }))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </button>
      <button
        type='button'
        title='Heading 3'
        aria-label='Heading 3'
        className={toolbarBtnClass(editor.isActive('heading', { level: 3 }))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={14} />
      </button>

      <div className='w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1' />

      <button
        type='button'
        title='Bullet list'
        aria-label='Bullet list'
        className={toolbarBtnClass(editor.isActive('bulletList'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </button>
      <button
        type='button'
        title='Numbered list'
        aria-label='Numbered list'
        className={toolbarBtnClass(editor.isActive('orderedList'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </button>
      <button
        type='button'
        title='Blockquote'
        aria-label='Blockquote'
        className={toolbarBtnClass(editor.isActive('blockquote'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </button>
      <button
        type='button'
        title='Inline code'
        aria-label='Inline code'
        className={toolbarBtnClass(editor.isActive('code'))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={14} />
      </button>

      <div className='w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1' />

      <button
        type='button'
        title='Link'
        aria-label='Link'
        className={toolbarBtnClass(editor.isActive('link') || linkOpen)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setLinkOpen((open) => !open)}
      >
        <LinkIcon size={14} />
      </button>

      {linkOpen && (
        <div className='absolute top-full left-2 z-40 mt-1 flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-1.5 shadow-lg'>
          <input
            ref={linkInputRef}
            type='url'
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setLinkOpen(false)
              }
            }}
            placeholder='https://…'
            className='w-56 sm:w-72 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500'
          />
          <button
            type='button'
            title='Apply link'
            aria-label='Apply link'
            className={toolbarBtnClass(false)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyLink}
          >
            <Check size={14} />
          </button>
          <button
            type='button'
            title='Cancel'
            aria-label='Cancel'
            className={toolbarBtnClass(false)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setLinkOpen(false)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

interface MarkdownPreviewEditorProps {
  content: string
  onChange: (value: string) => void
  scrollRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: () => void
  frontMatterBanner?: React.ReactNode
}

/**
 * Editable markdown preview powered by TipTap + @tiptap/markdown.
 * Syncs bidirectionally with the raw markdown source via `content` / `onChange`.
 */
export default function MarkdownPreviewEditor({
  content,
  onChange,
  scrollRef,
  onScroll,
  frontMatterBanner,
}: MarkdownPreviewEditorProps) {
  const isInternalUpdate = useRef(false)
  const frontMatterPrefixRef = useRef('')
  const lastEmittedRef = useRef<string | null>(null)
  const initial = splitMarkdownFrontMatter(content)
  frontMatterPrefixRef.current = initial.prefix

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // StarterKit ships Link; we configure our own below.
        link: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: {
          HTMLAttributes: {
            class:
              'rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 font-mono text-sm my-3 overflow-x-auto',
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-6 mb-4 space-y-1.5',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-6 mb-4 space-y-1.5',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class:
              'border-l-4 border-emerald-500 dark:border-emerald-400 pl-4 py-0.5 my-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-r-md italic',
          },
        },
        code: {
          HTMLAttributes: {
            class:
              'px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/50 text-emerald-600 dark:text-emerald-400 font-mono text-[0.875em] border border-zinc-200 dark:border-zinc-700/50',
          },
        },
      }),
      // GFM pipe tables — required for @tiptap/markdown table tokens.
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class:
            'border-collapse table-fixed w-full border border-zinc-300 dark:border-zinc-700 my-4',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-zinc-300 dark:border-zinc-700',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class:
            'border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-left font-semibold relative',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class:
            'border border-zinc-300 dark:border-zinc-700 px-3 py-2 relative',
        },
      }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          class:
            'text-emerald-600 dark:text-emerald-400 underline underline-offset-2',
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing in preview…',
      }),
      Markdown,
    ],
    content: initial.body,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: cn(
          'tiptap markdown-preview-editor focus:outline-none min-h-full',
          'text-zinc-700 dark:text-zinc-300 leading-7'
        ),
      },
      handleClick(_view, _pos, event) {
        const anchor = (event.target as HTMLElement).closest('a')
        if (!anchor) return false
        const href = anchor.getAttribute('href')
        if (!href) return false
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          window.open(href, '_blank', 'noopener,noreferrer')
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md =
        frontMatterPrefixRef.current +
        sanitizeSerializedMarkdown(ed.getMarkdown())
      lastEmittedRef.current = md
      isInternalUpdate.current = true
      onChange(md)
      queueMicrotask(() => {
        isInternalUpdate.current = false
      })
    },
  })

  // Source → Preview: apply external markdown changes without feedback loops
  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) return
    if (
      lastEmittedRef.current !== null &&
      normalizeMarkdown(content) === normalizeMarkdown(lastEmittedRef.current)
    ) {
      return
    }

    const { prefix, body } = splitMarkdownFrontMatter(content)
    frontMatterPrefixRef.current = prefix

    const current = normalizeMarkdown(editor.getMarkdown())
    const incoming = normalizeMarkdown(body)
    if (current === incoming) {
      lastEmittedRef.current = content
      return
    }

    const { from, to } = editor.state.selection
    editor.commands.setContent(body, {
      contentType: 'markdown',
      emitUpdate: false,
    })
    lastEmittedRef.current = content
    try {
      const maxPos = editor.state.doc.content.size
      editor.commands.setTextSelection({
        from: Math.min(from, maxPos),
        to: Math.min(to, maxPos),
      })
    } catch {
      // ignore selection restore failures
    }
  }, [content, editor])

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  if (!editor) {
    return (
      <div className='h-full p-8 text-sm text-zinc-400 dark:text-zinc-600 italic'>
        Loading preview editor…
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full min-h-0'>
      <PreviewFormatToolbar editor={editor} />
      <div
        ref={scrollRef}
        className='flex-1 overflow-y-auto p-8'
        onScroll={onScroll}
      >
        {frontMatterBanner}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
