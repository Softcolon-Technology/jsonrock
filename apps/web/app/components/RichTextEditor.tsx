'use client'

import React, { useCallback } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import { Sketch } from '@uiw/react-color'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { CharacterCount } from '@tiptap/extension-character-count'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontFamily } from '@tiptap/extension-font-family'
import { Highlight } from '@tiptap/extension-highlight'
import { Link as TiptapLink } from '@tiptap/extension-link'
import { Image as TiptapImage } from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlock from '@tiptap/extension-code-block'
import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CodeBlockComponent } from './editor/CodeBlockComponent'
import Cookies from 'js-cookie'

const getCookieComments = (slug: string) => {
  try {
    const raw = Cookies.get(`json-cracker-comments-${slug}`)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    return []
  }
}

const addCookieComment = (slug: string, commentId: string) => {
  const existing = getCookieComments(slug)
  if (!existing.includes(commentId)) {
    const updated = [...existing, commentId]
    Cookies.set(`json-cracker-comments-${slug}`, JSON.stringify(updated), {
      expires: 30,
    })
  }
}

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Highlighter,
  Quote,
  Undo,
  Redo,
  Code as CodeIcon,
  Maximize,
  Minimize,
  Type,
  X,
  MessageSquare,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Define FontSize Extension
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

const handleTextDownload = async (
  content: string,
  requestedFilename: string
) => {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: requestedFilename,
        types: [
          {
            description: 'Text File',
            accept: { 'text/plain': ['.txt'] },
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
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = requestedFilename
  a.click()
  URL.revokeObjectURL(url)
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle', 'paragraph', 'heading', 'listItem'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const val = element.style.fontSize
              if (!val) return null
              if (val.includes('px')) {
                const px = parseFloat(val)
                return Math.round(px * 0.75).toString()
              }
              return val.replace(/['"]+/g, '').replace(/pt/, '')
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}pt !important`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain, state, commands }: any) => {
          // If selection is inside a list item, update the list item too
          const { selection } = state
          const { $from, $to } = selection

          const chainBuilder = chain().setMark('textStyle', { fontSize })

          state.doc.nodesBetween(
            $from.pos,
            $to.pos,
            (node: any, pos: number) => {
              if (node.type.name === 'listItem') {
                chainBuilder.updateAttributes('listItem', { fontSize })
              }
            }
          )

          return chainBuilder.run()
        },
      unsetFontSize:
        () =>
        ({ chain }: any) => {
          return chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run()
        },
    }
  },
})

// Tab Key Support Extension
const TabKey = Extension.create({
  name: 'tabKey',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Insert 4 non-breaking spaces for visual tab
        return this.editor.commands.insertContent('\u00A0\u00A0\u00A0\u00A0')
      },
    }
  },
})

// Comment Mark Extension
export interface CommentOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (attributes: {
        id: string
        text: string
        createdAt: number
        isOwner: boolean
      }) => ReturnType
      unsetComment: (id: string) => ReturnType
    }
  }
}

export const CommentMark = Mark.create<CommentOptions>({
  name: 'comment',
  excludes: '',
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'relative',
      },
    }
  },
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {}
          return { 'data-comment-id': attributes.id }
        },
      },
      text: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-text'),
        renderHTML: (attributes) => {
          if (!attributes.text) return {}
          return { 'data-comment-text': attributes.text }
        },
      },
      isOwner: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute('data-comment-is-owner') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.isOwner) return {}
          return { 'data-comment-is-owner': 'true' }
        },
      },
      createdAt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-created-at'),
        renderHTML: (attributes) => {
          if (!attributes.createdAt) return {}
          return { 'data-comment-created-at': attributes.createdAt }
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ]
  },
  addCommands() {
    return {
      setComment:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      unsetComment:
        (id) =>
        ({ tr, dispatch }) => {
          const markType = this.type
          let hasChanged = false
          tr.doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type === markType && mark.attrs.id === id) {
                  tr.removeMark(pos, pos + node.nodeSize, mark)
                  hasChanged = true
                }
              })
            }
          })
          if (hasChanged && dispatch) {
            dispatch(tr)
            return true
          }
          return false
        },
    }
  },
})

const CommentItem = ({ comment, canDelete, onDelete, forceLightMode }: any) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isClamped, setIsClamped] = React.useState(false)
  const textRef = React.useRef<HTMLParagraphElement>(null)

  React.useEffect(() => {
    if (textRef.current) {
      if (textRef.current.scrollHeight > textRef.current.clientHeight) {
        setIsClamped(true)
      }
    }
  }, [comment.text]) // check on mount/update

  return (
    <div className='flex flex-col gap-1 border-b border-zinc-100 dark:border-zinc-700 pb-2 last:border-0 last:pb-0'>
      <div className='flex items-center gap-2 mb-0.5'>
        <span
          className={cn(
            'text-[8px] uppercase font-bold py-0.5 px-1.5 rounded',
            comment.isOwner
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
          )}
        >
          {comment.isOwner ? 'Owner' : 'Anonymous User'}
        </span>
        <span className='text-[9px] text-zinc-400'>
          {new Date(comment.createdAt).toLocaleString()}
        </span>
      </div>
      <div className='flex flex-col items-start'>
        <p
          ref={textRef}
          className={cn(
            'text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed transition-all duration-200',
            !forceLightMode && 'dark:text-zinc-300',
            !isExpanded && 'line-clamp-4'
          )}
        >
          {comment.text}
        </p>
        {(isClamped || isExpanded) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className='text-[10px] text-blue-500 hover:text-blue-600 font-bold mt-1 uppercase tracking-wider'
          >
            {isExpanded ? 'Show less' : 'Show more...'}
          </button>
        )}
      </div>
      {canDelete && (
        <div className='flex justify-end mt-1'>
          <button
            onClick={onDelete}
            className='text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider'
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  readOnly?: boolean
  remoteContent?: string | null
  forceLightMode?: boolean
  isCurrentUserOwner?: boolean
  slug?: string | null
}

const CommentDecorations = ({
  editor,
  onTriggerClick,
  scrollContainerRef,
}: {
  editor: Editor
  onTriggerClick: (nodes: HTMLElement[]) => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) => {
  const [layout, setLayout] = React.useState({
    proseLeft: 0,
    groups: [] as { top: number; nodes: HTMLElement[] }[],
  })

  React.useEffect(() => {
    const updateIcons = () => {
      const container = scrollContainerRef.current
      if (!container) return
      const dom = editor.view.dom

      const containerRect = container.getBoundingClientRect()
      const domRect = dom.getBoundingClientRect()

      // The exact horizontal start of the text wrapper
      const proseLeft = domRect.left - containerRect.left + container.scrollLeft

      const commentNodes = Array.from(
        dom.querySelectorAll('[data-comment-id]')
      ) as HTMLElement[]

      // 1. Group by semantic Comment ID to prevent multi-line comments from creating duplicate icons
      const commentsById = new Map<
        string,
        { top: number; nodes: HTMLElement[] }
      >()

      commentNodes.forEach((el) => {
        const id = el.getAttribute('data-comment-id')
        if (!id) return

        const rect = el.getBoundingClientRect()
        // Check if node is visible
        if (rect.width === 0 && rect.height === 0) return

        // Calculate top relative to the scrolling content
        const top = rect.top - containerRect.top + container.scrollTop

        if (!commentsById.has(id)) {
          commentsById.set(id, { top, nodes: [el] })
        } else {
          const entry = commentsById.get(id)!
          entry.nodes.push(el)
          // Always pin to the highest visible node of this comment
          if (top < entry.top) {
            entry.top = top
          }
        }
      })

      // 2. Visually group distinct comments if they start near each other
      const groups: { top: number; nodes: HTMLElement[] }[] = []
      const sortedComments = Array.from(commentsById.values()).sort(
        (a, b) => a.top - b.top
      )

      sortedComments.forEach((comment) => {
        const existingGroup = groups.find(
          (g) => Math.abs(g.top - comment.top) < 24
        )
        if (existingGroup) {
          existingGroup.nodes.push(...comment.nodes)
        } else {
          groups.push({ top: comment.top, nodes: [...comment.nodes] })
        }
      })

      setLayout({ proseLeft, groups })
    }

    editor.on('transaction', updateIcons)
    window.addEventListener('resize', updateIcons)
    const observer = new MutationObserver(updateIcons)
    observer.observe(editor.view.dom, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    const timer = setTimeout(updateIcons, 100)

    return () => {
      clearTimeout(timer)
      editor.off('transaction', updateIcons)
      window.removeEventListener('resize', updateIcons)
      observer.disconnect()
    }
  }, [editor, scrollContainerRef])

  return (
    <div
      className='absolute top-0 bottom-0 pointer-events-none z-10 w-0'
      style={{ left: layout.proseLeft }}
    >
      {layout.groups.map((group, i) => (
        <span
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            onTriggerClick(group.nodes)
          }}
          className='absolute -left-[40px] md:-left-[54px] w-8 h-8 flex items-center justify-center cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full shadow-md border border-zinc-200 dark:border-zinc-700 pointer-events-auto transition-all hover:scale-105'
          style={{ top: group.top - 4 }}
          title='View Comments'
        >
          <img
            src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNzE3MTdhIiBzdHJva2Utd2lkdGg9IjIuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNy45IDIwQTkgOSAwIDEgMCA0IDE2LjFMMiAyMloiLz48L3N2Zz4='
            className='w-[18px] h-[18px] opacity-80'
            alt='Comment'
          />
        </span>
      ))}
    </div>
  )
}

const ToolbarButton = ({
  onClick,
  isActive,
  disabled,
  children,
  title,
  forceLightMode,
}: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'p-1.5 rounded hover:bg-zinc-200 transition-colors flex items-center justify-center min-w-[28px]',
      !forceLightMode && 'dark:hover:bg-zinc-800',
      isActive
        ? cn(
            'bg-zinc-200 text-zinc-900',
            !forceLightMode && 'dark:bg-zinc-700 dark:text-zinc-100'
          )
        : cn('text-zinc-600', !forceLightMode && 'dark:text-zinc-400'),
      disabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    {children}
  </button>
)

const ToolbarDivider = ({ forceLightMode }: { forceLightMode?: boolean }) => (
  <div
    className={cn(
      'w-px h-5 bg-zinc-300 mx-1.5 my-auto shrink-0',
      !forceLightMode && 'dark:bg-zinc-700'
    )}
  />
)

const Toolbar = ({
  editor,
  forceLightMode,
  isFullScreen,
  onToggleFullScreen,
  isCurrentUserOwner,
  slug,
}: {
  editor: Editor | null
  forceLightMode?: boolean
  isFullScreen: boolean
  onToggleFullScreen: () => void
  isCurrentUserOwner: boolean
  slug?: string | null
}) => {
  const [isTextColorOpen, setIsTextColorOpen] = React.useState(false)
  const [isHighlightColorOpen, setIsHighlightColorOpen] = React.useState(false)
  const [isCommentInputOpen, setIsCommentInputOpen] = React.useState(false)
  const [commentDraft, setCommentDraft] = React.useState('')

  const [localTextColor, setLocalTextColor] = React.useState(
    editor?.getAttributes('textStyle').color || '#000000'
  )
  const [localHighlightColor, setLocalHighlightColor] = React.useState(
    editor?.getAttributes('highlight').color || '#fef08a'
  )

  React.useEffect(() => {
    if (!editor) return
    const updateColors = () => {
      setLocalTextColor(editor.getAttributes('textStyle').color || '#000000')
      setLocalHighlightColor(
        editor.getAttributes('highlight').color || '#fef08a'
      )
    }
    editor.on('selectionUpdate', updateColors)
    return () => {
      editor.off('selectionUpdate', updateColors)
    }
  }, [editor])

  const textColorRef = React.useRef<HTMLDivElement>(null)
  const highlightColorRef = React.useRef<HTMLDivElement>(null)
  const commentRef = React.useRef<HTMLDivElement>(null)

  // Handle outside clicks to close dropdowns
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        textColorRef.current &&
        !textColorRef.current.contains(event.target as Node)
      ) {
        setIsTextColorOpen(false)
      }
      if (
        highlightColorRef.current &&
        !highlightColorRef.current.contains(event.target as Node)
      ) {
        setIsHighlightColorOpen(false)
      }
      if (
        commentRef.current &&
        !commentRef.current.contains(event.target as Node)
      ) {
        setIsCommentInputOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const size = e.target.value
      if (size) {
        editor?.commands.setFontSize(size)
      } else {
        editor?.commands.unsetFontSize()
      }
    },
    [editor]
  )

  const getCurrentFontSize = () => {
    if (!editor) return '14'
    const markAttrs = editor.getAttributes('textStyle')
    if (markAttrs.fontSize) return markAttrs.fontSize.toString()

    // Look up parent nodes (paragraph, heading, listItem)
    const { $from } = editor.state.selection
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth)
      if (node.attrs.fontSize) {
        return node.attrs.fontSize.toString()
      }
    }

    return '14'
  }

  const detectedSize = getCurrentFontSize()
  const fontSizeOptions = [
    10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72, 96,
  ]

  // If detected size is not in list, add it temporarily
  if (detectedSize && !fontSizeOptions.includes(parseInt(detectedSize))) {
    fontSizeOptions.push(parseInt(detectedSize))
    fontSizeOptions.sort((a, b) => a - b)
  }

  if (!editor) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-200 bg-zinc-50 shrink-0',
        !forceLightMode && 'dark:border-zinc-800 dark:bg-zinc-900'
      )}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title='Undo'
        forceLightMode={forceLightMode}
      >
        <Undo className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title='Redo'
        forceLightMode={forceLightMode}
      >
        <Redo className='w-4 h-4' />
      </ToolbarButton>

      <ToolbarDivider forceLightMode={forceLightMode} />

      <select
        value={detectedSize}
        onChange={handleFontSizeChange}
        className={cn(
          'h-7 px-1 text-xs border rounded bg-white border-zinc-200 text-zinc-700 min-w-[60px]',
          !forceLightMode &&
            'dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
        )}
      >
        {fontSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      <ToolbarDivider forceLightMode={forceLightMode} />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title='Bold'
        forceLightMode={forceLightMode}
      >
        <Bold className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title='Italic'
        forceLightMode={forceLightMode}
      >
        <Italic className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title='Underline'
        forceLightMode={forceLightMode}
      >
        <UnderlineIcon className='w-4 h-4' />
      </ToolbarButton>

      <div className='relative' ref={textColorRef}>
        <ToolbarButton
          onClick={() => setIsTextColorOpen(!isTextColorOpen)}
          title='Text Color'
          forceLightMode={forceLightMode}
          isActive={isTextColorOpen}
        >
          <div className='flex flex-col items-center'>
            <Type className='w-4 h-4' />
            <div
              className='w-3 h-0.5 mt-0.5'
              style={{
                backgroundColor:
                  editor.getAttributes('textStyle').color || 'currentColor',
              }}
            />
          </div>
        </ToolbarButton>
        {isTextColorOpen && (
          <div
            className={cn(
              'absolute top-full left-0 mt-2 z-110 p-3 bg-white border border-zinc-200 rounded-md shadow-2xl animate-in fade-in slide-in-from-top-1',
              !forceLightMode && 'dark:bg-zinc-800 dark:border-zinc-700'
            )}
          >
            <div className='flex flex-col gap-3'>
              <div className='flex items-center justify-between gap-4'>
                <span className='text-[10px] font-bold uppercase tracking-wider text-zinc-400'>
                  Text Color
                </span>
                <button
                  onClick={() => {
                    editor.chain().focus().unsetColor().run()
                    setIsTextColorOpen(false)
                  }}
                  className='text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-600'
                >
                  Reset
                </button>
              </div>
              <Sketch
                color={localTextColor}
                onChange={(color) => {
                  setLocalTextColor(color.hex)
                }}
                className='bg-transparent! border-none! shadow-none!'
                disableAlpha={true}
              />
              <div className='flex items-center gap-2 mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-700/50 justify-center'>
                <button
                  onClick={() => {
                    setLocalTextColor(
                      editor.getAttributes('textStyle').color || '#000000'
                    )
                    setIsTextColorOpen(false)
                  }}
                  className='flex-1 py-1.5 px-3 text-sm font-semibold text-blue-500 bg-white border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700 rounded transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editor) {
                      editor.chain().focus().setColor(localTextColor).run()
                    }
                    setIsTextColorOpen(false)
                  }}
                  className='flex-1 py-1.5 px-3 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors shadow-sm'
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className='relative' ref={highlightColorRef}>
        <ToolbarButton
          onClick={() => setIsHighlightColorOpen(!isHighlightColorOpen)}
          isActive={editor.isActive('highlight') || isHighlightColorOpen}
          title='Highlight Color'
          forceLightMode={forceLightMode}
        >
          <Highlighter className='w-4 h-4' />
        </ToolbarButton>
        {isHighlightColorOpen && (
          <div
            className={cn(
              'absolute top-full left-0 mt-2 z-110 p-3 bg-white border border-zinc-200 rounded-md shadow-2xl animate-in fade-in slide-in-from-top-1',
              !forceLightMode && 'dark:bg-zinc-800 dark:border-zinc-700'
            )}
          >
            <div className='flex flex-col gap-3'>
              <div className='flex items-center justify-between gap-4'>
                <span className='text-[10px] font-bold uppercase tracking-wider text-zinc-400'>
                  Highlight
                </span>
                <button
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run()
                    setIsHighlightColorOpen(false)
                  }}
                  className='text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-600'
                >
                  None
                </button>
              </div>
              <Sketch
                color={localHighlightColor}
                onChange={(color) => {
                  setLocalHighlightColor(color.hex)
                }}
                className='bg-transparent! border-none! shadow-none!'
                disableAlpha={true}
              />
              <div className='flex items-center gap-2 mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-700/50 justify-center'>
                <button
                  onClick={() => {
                    setLocalHighlightColor(
                      editor.getAttributes('highlight').color || '#fef08a'
                    )
                    setIsHighlightColorOpen(false)
                  }}
                  className='flex-1 py-1.5 px-3 text-sm font-semibold text-blue-500 bg-white border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700 rounded transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editor) {
                      editor
                        .chain()
                        .focus()
                        .setHighlight({ color: localHighlightColor })
                        .run()
                    }
                    setIsHighlightColorOpen(false)
                  }}
                  className='flex-1 py-1.5 px-3 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors shadow-sm'
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title='Code Block'
        forceLightMode={forceLightMode}
      >
        <CodeIcon className='w-4 h-4' />
      </ToolbarButton>

      <div className='relative' ref={commentRef}>
        <ToolbarButton
          onClick={() => setIsCommentInputOpen(!isCommentInputOpen)}
          isActive={isCommentInputOpen || editor.isActive('comment')}
          title='Add Comment'
          forceLightMode={forceLightMode}
        >
          <MessageSquare className='w-4 h-4' />
        </ToolbarButton>
        {isCommentInputOpen && (
          <div
            className={cn(
              'absolute top-full left-0 mt-2 z-110 p-3 bg-white border border-zinc-200 rounded-md shadow-2xl flex flex-col gap-2 min-w-[240px] animate-in fade-in slide-in-from-top-1',
              !forceLightMode && 'dark:bg-zinc-800 dark:border-zinc-700'
            )}
          >
            <span className='text-[10px] font-bold uppercase tracking-wider text-zinc-400'>
              Add Comment
            </span>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              className={cn(
                'w-full h-20 p-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none',
                !forceLightMode &&
                  'dark:bg-zinc-900 dark:border-zinc-600 dark:text-zinc-200'
              )}
              placeholder='Type your comment...'
              autoFocus
            />
            <button
              className='bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded hover:bg-emerald-600 self-end transition-colors'
              onClick={() => {
                if (!commentDraft.trim()) return
                const id = Math.random().toString(36).substr(2, 9)
                editor
                  .chain()
                  .focus()
                  .setComment({
                    id,
                    text: commentDraft.trim(),
                    createdAt: Date.now(),
                    isOwner: isCurrentUserOwner,
                  })
                  .run()

                if (!isCurrentUserOwner && slug) {
                  addCookieComment(slug, id)
                }

                setCommentDraft('')
                setIsCommentInputOpen(false)
              }}
            >
              Post
            </button>
          </div>
        )}
      </div>

      <ToolbarDivider forceLightMode={forceLightMode} />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title='Align Left'
        forceLightMode={forceLightMode}
      >
        <AlignLeft className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title='Align Center'
        forceLightMode={forceLightMode}
      >
        <AlignCenter className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title='Align Right'
        forceLightMode={forceLightMode}
      >
        <AlignRight className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title='Justify'
        forceLightMode={forceLightMode}
      >
        <AlignJustify className='w-4 h-4' />
      </ToolbarButton>

      <ToolbarDivider forceLightMode={forceLightMode} />

      <ToolbarButton
        onClick={() => {
          const currentSize = getCurrentFontSize()
          editor.chain().focus().toggleBulletList().run()
          // Sync font size to list items immediately
          editor.commands.setFontSize(currentSize)
        }}
        isActive={editor.isActive('bulletList')}
        title='Bullet List'
        forceLightMode={forceLightMode}
      >
        <List className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const currentSize = getCurrentFontSize()
          editor.chain().focus().toggleOrderedList().run()
          // Sync font size to list items immediately
          editor.commands.setFontSize(currentSize)
        }}
        isActive={editor.isActive('orderedList')}
        title='Ordered List'
        forceLightMode={forceLightMode}
      >
        <ListOrdered className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title='Blockquote'
        forceLightMode={forceLightMode}
      >
        <Quote className='w-4 h-4' />
      </ToolbarButton>

      <div className='flex-1' />
      <div className='pr-1 flex items-center gap-1'>
        <ToolbarDivider forceLightMode={forceLightMode} />
        <ToolbarButton
          onClick={() => {
            if (editor && slug) {
              const text = editor.getText()
              handleTextDownload(text, 'document.txt')
            }
          }}
          title={
            !slug
              ? 'Save or create document first to download'
              : 'Download Text'
          }
          forceLightMode={forceLightMode}
          disabled={!slug}
        >
          <Download className='w-4 h-4' />
        </ToolbarButton>
        <ToolbarButton
          onClick={onToggleFullScreen}
          title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          forceLightMode={forceLightMode}
          isActive={isFullScreen}
        >
          {isFullScreen ? (
            <Minimize className='w-4 h-4 text-emerald-600' />
          ) : (
            <Maximize className='w-4 h-4' />
          )}
        </ToolbarButton>
      </div>
    </div>
  )
}

const StatusBar = ({
  editor,
  forceLightMode,
}: {
  editor: Editor | null
  forceLightMode?: boolean
}) => {
  const [stats, setStats] = React.useState({
    words: 0,
    lines: 0,
    characters: 0,
  })

  React.useEffect(() => {
    if (!editor) return

    const updateStats = () => {
      const wordCount = editor.storage.characterCount?.words() || 0
      const charCount = editor.storage.characterCount?.characters() || 0

      // Calculate actual lines (blocks)
      let lineCount = 0
      editor.state.doc.descendants((node) => {
        if (
          node.type.name === 'paragraph' ||
          node.type.name === 'heading' ||
          node.type.name === 'codeBlock'
        ) {
          lineCount++
        }
      })

      setStats({ words: wordCount, lines: lineCount, characters: charCount })
    }

    // Initial update
    updateStats()

    // Listen to all relevant events
    editor.on('transaction', updateStats)
    editor.on('update', updateStats)
    editor.on('selectionUpdate', updateStats)

    return () => {
      editor.off('transaction', updateStats)
      editor.off('update', updateStats)
      editor.off('selectionUpdate', updateStats)
    }
  }, [editor])

  if (!editor) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-1.5 border-t border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500 font-medium',
        !forceLightMode && 'dark:border-zinc-800 dark:bg-zinc-900/50'
      )}
    >
      <div className='flex gap-4'>
        <span>Words: {stats.words}</span>
        <span>Lines: {stats.lines}</span>
      </div>
      <div></div>
    </div>
  )
}

const RichTextEditor = ({
  content,
  onChange,
  readOnly,
  remoteContent,
  forceLightMode,
  isCurrentUserOwner = false,
  slug,
}: RichTextEditorProps) => {
  const isRemoteUpdate = React.useRef(false)
  const [, forceUpdate] = React.useState({})
  const containerRef = React.useRef<HTMLDivElement>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [isFullScreen, setIsFullScreen] = React.useState(false)
  const [activeCommentPopup, setActiveCommentPopup] = React.useState<{
    comments: {
      id: string
      text: string
      createdAt: number
      isOwner: boolean
    }[]
    iconTop: number
    iconBottom: number
    left: number
  } | null>(null)

  // Listen for browser fullscreen change events
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (wrapperRef.current?.requestFullscreen) {
        wrapperRef.current.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`)
        })
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc list-outside ml-6',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal list-outside ml-6',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'pl-1',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: cn(
              'border-l-4 border-zinc-300 pl-4 italic my-4',
              !forceLightMode && 'dark:border-zinc-700'
            ),
          },
        },
      }),
      Placeholder.configure({
        placeholder: 'Type your text here...',
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: cn(
            'page-code-block not-prose bg-zinc-100 text-zinc-800 p-3 rounded-md border border-zinc-200 font-mono text-sm shadow-sm my-2 block',
            !forceLightMode &&
              'dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200'
          ),
        },
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent)
        },
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      CharacterCount,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontFamily,
      CommentMark,
      Highlight.configure({
        multicolor: true,
      }),
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      TabKey,
    ],
    content: content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'tiptap prose prose-sm md:prose-base lg:prose-lg focus:outline-none w-full max-w-none',
          !forceLightMode && 'dark:prose-invert'
        ),
        style:
          'line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; min-height: 100%; outline: none;',
      },
    },
    onUpdate: ({ editor }) => {
      if (isRemoteUpdate.current) return
      onChange(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
      forceUpdate({})
      const { empty, $from } = editor.state.selection
      if (empty) {
        const parent = $from.parent
        if (
          parent.content.size === 0 &&
          (parent.type.name === 'paragraph' || parent.type.name === 'heading')
        ) {
          const activeFontSize = editor.getAttributes('textStyle').fontSize
          if (activeFontSize && parent.attrs.fontSize !== activeFontSize) {
            editor.commands.updateAttributes(parent.type.name, {
              fontSize: activeFontSize,
            })
          }
        }
      }
    },
    onTransaction: () => forceUpdate({}),
  })

  // Handle Remote Updates
  React.useEffect(() => {
    if (remoteContent && editor) {
      const currentHTML = editor.getHTML()
      if (currentHTML !== remoteContent) {
        isRemoteUpdate.current = true
        editor.commands.setContent(remoteContent)
        isRemoteUpdate.current = false
      }
    }
  }, [remoteContent, editor])

  // Cleanup
  React.useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'flex flex-col h-full bg-white transition-colors duration-300',
        !forceLightMode && 'dark:bg-[#050505]',
        isFullScreen && 'w-screen h-screen'
      )}
    >
      {!readOnly && (
        <Toolbar
          editor={editor}
          forceLightMode={forceLightMode}
          isFullScreen={isFullScreen}
          onToggleFullScreen={toggleFullScreen}
          isCurrentUserOwner={isCurrentUserOwner}
          slug={slug}
        />
      )}

      {activeCommentPopup &&
        (() => {
          const spaceBelow =
            typeof window !== 'undefined'
              ? window.innerHeight - activeCommentPopup.iconBottom
              : 1000
          const spaceAbove = activeCommentPopup.iconTop
          const renderAbove = spaceBelow < 250 && spaceAbove > spaceBelow

          return (
            <div
              className={cn(
                'fixed z-50 bg-white border border-zinc-200 rounded-lg shadow-xl p-3 flex flex-col gap-2 min-w-[250px] max-w-[340px] animate-in fade-in',
                !forceLightMode && 'dark:bg-zinc-800 dark:border-zinc-700'
              )}
              style={{
                ...(renderAbove
                  ? {
                      bottom:
                        (typeof window !== 'undefined'
                          ? window.innerHeight
                          : 1000) -
                        activeCommentPopup.iconTop +
                        8,
                    }
                  : { top: activeCommentPopup.iconBottom + 8 }),
                left: activeCommentPopup.left,
              }}
            >
              <span className='text-[10px] font-bold uppercase tracking-wider text-zinc-400'>
                Comments ({activeCommentPopup.comments.length})
              </span>
              <div
                className='flex flex-col gap-3 overflow-y-auto pr-1'
                style={{
                  maxHeight: Math.max(
                    150,
                    Math.min(400, (renderAbove ? spaceAbove : spaceBelow) - 80)
                  ),
                }}
              >
                {(() => {
                  const myComments = slug ? getCookieComments(slug) : []
                  return activeCommentPopup.comments.map((comment) => {
                    const canDelete =
                      isCurrentUserOwner ||
                      (!readOnly &&
                        !comment.isOwner &&
                        myComments.includes(comment.id))
                    return (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        forceLightMode={forceLightMode}
                        canDelete={canDelete}
                        onDelete={() => {
                          editor?.chain().focus().unsetComment(comment.id).run()
                          if (activeCommentPopup.comments.length === 1) {
                            setActiveCommentPopup(null)
                          } else {
                            setActiveCommentPopup((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    comments: prev.comments.filter(
                                      (c) => c.id !== comment.id
                                    ),
                                  }
                                : null
                            )
                          }
                        }}
                      />
                    )
                  })
                })()}
              </div>
            </div>
          )
        })()}

      <div
        className='flex-1 overflow-y-auto relative'
        ref={scrollContainerRef}
        onClick={(e) => {
          setActiveCommentPopup(null)
          // Only forcefully regain focus if clicking the empty margin/padding
          if (
            e.target === e.currentTarget ||
            (containerRef.current && e.target === containerRef.current)
          ) {
            editor?.commands.focus()
          }
        }}
        onScroll={() => setActiveCommentPopup(null)}
      >
        {editor && (
          <CommentDecorations
            editor={editor}
            scrollContainerRef={scrollContainerRef}
            onTriggerClick={(groupNodes) => {
              if (groupNodes.length > 0) {
                const rect = groupNodes[0]!.getBoundingClientRect()
                const uniqueComments = new Map<
                  string,
                  {
                    id: string
                    text: string
                    createdAt: number
                    isOwner: boolean
                  }
                >()

                groupNodes.forEach((node) => {
                  let current: HTMLElement | null = node
                  while (current && current.nodeType === 1) {
                    // Node.ELEMENT_NODE
                    if (current.hasAttribute('data-comment-id')) {
                      const id = current.getAttribute('data-comment-id')!
                      if (!uniqueComments.has(id)) {
                        uniqueComments.set(id, {
                          id,
                          text: current.getAttribute('data-comment-text')!,
                          createdAt: Number(
                            current.getAttribute('data-comment-created-at')
                          ),
                          isOwner:
                            current.getAttribute('data-comment-is-owner') ===
                            'true',
                        })
                      }
                    }
                    current = current.parentElement
                  }
                })

                const comments = Array.from(uniqueComments.values())
                comments.sort((a, b) => a.createdAt - b.createdAt)

                setActiveCommentPopup({
                  comments,
                  iconTop: rect.top,
                  iconBottom: rect.bottom,
                  left: rect.left,
                })
              }
            }}
          />
        )}
        <div
          ref={containerRef}
          className='w-full min-h-full pl-12 pr-6 py-8 md:px-16 md:py-12 lg:px-24 lg:py-16 cursor-text'
        >
          <EditorContent editor={editor} />
        </div>
      </div>
      <StatusBar editor={editor} forceLightMode={forceLightMode} />
    </div>
  )
}

export default React.memo(RichTextEditor)
