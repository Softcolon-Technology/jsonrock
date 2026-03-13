'use client'

import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
  memo,
} from 'react'
import type { TreeNodeSlim } from '@/hooks/useJsonWorker'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 28 // px per tree row — static for virtual math
const OVERSCAN = 8 // extra rows rendered above/below viewport

// ── Type colour map (mirrors JsonNode.tsx) ─────────────────────────────────────
const typeColour: Record<string, string> = {
  string: 'text-emerald-600 dark:text-emerald-400',
  number: 'text-blue-500 dark:text-blue-400',
  boolean: 'text-rose-500 dark:text-rose-400',
  null: 'text-zinc-400 dark:text-zinc-500',
  object: 'text-zinc-500 dark:text-zinc-400',
  array: 'text-zinc-500 dark:text-zinc-400',
}

// ── Single row renderer ───────────────────────────────────────────────────────
interface TreeRowProps {
  node: TreeNodeSlim
  isExpanded: boolean
  style: React.CSSProperties
  onToggle: (id: string) => void
}

const TreeRow = memo(({ node, isExpanded, style, onToggle }: TreeRowProps) => {
  const indent = node.depth * 16

  return (
    <div
      className='flex items-center select-none hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer'
      style={{
        ...style,
        paddingLeft: indent + 4,
        height: ROW_HEIGHT,
        boxSizing: 'border-box',
      }}
      onClick={() => node.hasChildren && onToggle(node.id)}
    >
      {/* Expand/collapse chevron */}
      <span className='shrink-0 w-4 h-4 flex items-center justify-center text-zinc-400 dark:text-zinc-600'>
        {node.hasChildren ? (
          isExpanded ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )
        ) : (
          <span className='w-3 h-px bg-zinc-300 dark:bg-zinc-700 inline-block' />
        )}
      </span>

      {/* Key */}
      <span
        className='font-mono font-medium text-emerald-600 dark:text-emerald-400 shrink-0 mr-1'
        style={{ fontSize: 12 }}
      >
        {node.key}
        {node.type !== 'object' && node.type !== 'array' ? ': ' : ' '}
      </span>

      {/* Value / children count */}
      <span
        className={cn(
          'font-mono font-medium truncate',
          typeColour[node.type] ?? 'text-zinc-700 dark:text-zinc-200'
        )}
        style={{ fontSize: 12 }}
      >
        {node.type === 'object' || node.type === 'array' ? (
          <span className='text-zinc-400 dark:text-zinc-600'>{node.value}</span>
        ) : (
          node.value
        )}
      </span>
    </div>
  )
})
TreeRow.displayName = 'TreeRow'

// ── Compute visible nodes (flat list filtered by expanded state) ──────────────
function computeVisible(
  nodes: TreeNodeSlim[],
  expandedIds: Set<string>
): TreeNodeSlim[] {
  const visible: TreeNodeSlim[] = []
  // Build a set of IDs of nodes whose parent chain is fully expanded
  // We track which parentIds are expanded as we scan in order.
  // Since the flat list is in DFS order, we can do a single-pass filter.
  const expandedParents = new Set<string>()

  for (const node of nodes) {
    // Root nodes (depth 0) are always visible
    if (node.depth === 0) {
      visible.push(node)
      if (expandedIds.has(node.id)) expandedParents.add(node.id)
      continue
    }
    // Node is visible if its parent is in expandedParents
    if (node.parentId !== null && expandedParents.has(node.parentId)) {
      visible.push(node)
      if (expandedIds.has(node.id)) expandedParents.add(node.id)
    }
  }

  return visible
}

// ── VirtualizedTree ───────────────────────────────────────────────────────────
interface VirtualizedTreeProps {
  nodes: TreeNodeSlim[]
}

export function VirtualizedTree({ nodes }: VirtualizedTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  // Expand nodes that are initially expanded by default
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const set = new Set<string>()
    for (const n of nodes) {
      if (n.isInitiallyExpanded && n.hasChildren) set.add(n.id)
    }
    return set
  })

  // Re-compute default expansion when nodes change (new JSON loaded)
  useEffect(() => {
    const set = new Set<string>()
    for (const n of nodes) {
      if (n.isInitiallyExpanded && n.hasChildren) set.add(n.id)
    }
    setExpandedIds(set)
    setScrollTop(0)
  }, [nodes])

  // Track container height for virtual window
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]: any) => {
      setContainerHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Derived: visible node list (respects expand/collapse state)
  const visibleNodes = useMemo(
    () => computeVisible(nodes, expandedIds),
    [nodes, expandedIds]
  )

  // Virtual window math
  const totalHeight = visibleNodes.length * ROW_HEIGHT
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const lastRow = Math.min(
    visibleNodes.length - 1,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
  )
  const renderedNodes = visibleNodes.slice(firstRow, lastRow + 1)

  return (
    <div
      ref={containerRef}
      className='h-full w-full overflow-y-auto overflow-x-hidden'
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      {nodes.length === 0 ? (
        <div className='flex items-center justify-center h-32 text-zinc-400 dark:text-zinc-600 text-sm font-mono'>
          Empty
        </div>
      ) : (
        /* Full-height spacer — ensures scrollbar is accurate */
        <div style={{ height: totalHeight, position: 'relative' }}>
          {renderedNodes.map((node, i) => (
            <TreeRow
              key={node.id}
              node={node}
              isExpanded={expandedIds.has(node.id)}
              onToggle={onToggle}
              style={{
                position: 'absolute',
                top: (firstRow + i) * ROW_HEIGHT,
                left: 0,
                right: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
