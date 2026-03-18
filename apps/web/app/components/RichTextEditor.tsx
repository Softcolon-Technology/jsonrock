'use client'

import React, { useCallback } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
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
import CodeBlock from '@tiptap/extension-code-block'
import { Extension } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CodeBlockComponent } from './editor/CodeBlockComponent'
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

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  readOnly?: boolean
  remoteContent?: string | null
  forceLightMode?: boolean
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
}: {
  editor: Editor | null
  forceLightMode?: boolean
}) => {
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
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title='Highlight'
        forceLightMode={forceLightMode}
      >
        <Highlighter className='w-4 h-4' />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title='Code Block'
        forceLightMode={forceLightMode}
      >
        <CodeIcon className='w-4 h-4' />
      </ToolbarButton>

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
}: RichTextEditorProps) => {
  const isRemoteUpdate = React.useRef(false)
  const [, forceUpdate] = React.useState({})
  const containerRef = React.useRef<HTMLDivElement>(null)

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
      CodeBlock.configure({
        HTMLAttributes: {
          class: cn(
            'page-code-block not-prose bg-zinc-100 p-3 rounded-md border border-zinc-200 font-mono text-sm shadow-sm my-2 block',
            !forceLightMode && 'dark:bg-zinc-800 dark:border-zinc-700'
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
      Highlight,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      TabKey,
    ],
    content: content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm md:prose-base lg:prose-lg focus:outline-none w-full max-w-none',
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
      className={cn(
        'flex flex-col h-full bg-white',
        !forceLightMode && 'dark:bg-[#050505]'
      )}
    >
      {!readOnly && <Toolbar editor={editor} forceLightMode={forceLightMode} />}
      <div
        className='flex-1 overflow-y-auto'
        onClick={() => editor?.commands.focus()}
      >
        <div
          ref={containerRef}
          className='w-full min-h-full px-6 py-8 md:px-16 md:py-12 lg:px-24 lg:py-16 cursor-text'
        >
          <EditorContent editor={editor} />
        </div>
      </div>
      <StatusBar editor={editor} forceLightMode={forceLightMode} />
    </div>
  )
}

export default React.memo(RichTextEditor)
