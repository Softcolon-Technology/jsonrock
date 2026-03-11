import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { GraphNodeData } from '@/lib/graph-layout'
import { cn } from '@/lib/utils'

// ─── Type colours ────────────────────────────────────────────────────────────
const TypeColor: Record<string, string> = {
  number: 'text-blue-500 dark:text-blue-400',
  boolean: 'text-rose-500 dark:text-rose-400',
  null: 'text-zinc-400 dark:text-zinc-500',
}
const keyClass = 'text-emerald-600 dark:text-emerald-400'
const valueDefaultClass = 'text-black dark:text-white'

// ─── JsonNode ─────────────────────────────────────────────────────────────────
// Styling mirrors JSONCrack exactly:
//   • font-size: 12px, font-weight: 500, font-family: monospace
//   • row height: 30px   (ROW_HEIGHT constant in graph-layout.ts)
//   • header height: 36px (PARENT_HEIGHT constant)
//   • padding: 3px 10px per row
//   • white-space: nowrap + text-overflow: ellipsis — NEVER wraps
//   • width is set by graph-layout (DOM-measured, matches actual rendering)
const JsonNode = ({ data, selected }: NodeProps<GraphNodeData>) => {
  return (
    <div
      className={cn(
        'rounded-sm border bg-white dark:bg-[#1e1e1e] shadow-md transition-colors duration-150 overflow-hidden',
        selected
          ? 'border-emerald-500 ring-1 ring-emerald-500/30'
          : 'border-zinc-200 dark:border-zinc-700'
      )}
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontWeight: 500,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* Target handle — always at center-left, invisible */}
      <Handle
        type='target'
        position={Position.Left}
        style={{ opacity: 0, background: 'transparent', border: 'none' }}
      />

      {/* Source handles:
          • Multi-child: one handle per child, each at an evenly-spaced top% within the node.
            React Flow's CSS class keeps transform: translateY(-50%) so the handle center
            sits exactly at the top% position — always within [0%, 100%] of the node.
          • Single/no children: standard center handle (default 50%). */}
      {data.sourceHandlePositions && data.sourceHandlePositions.length > 0 ? (
        data.sourceHandlePositions.map(({ id, topPercent }) => (
          <Handle
            key={id}
            id={id}
            type='source'
            position={Position.Right}
            style={{
              opacity: 0,
              background: 'transparent',
              border: 'none',
              top: `${topPercent}%`,
              // React Flow's CSS class keeps transform: translateY(-50%) for correct centering
            }}
          />
        ))
      ) : (
        <Handle
          type='source'
          position={Position.Right}
          style={{ opacity: 0, background: 'transparent', border: 'none' }}
        />
      )}

      {/* height: 36px (PARENT_HEIGHT), matches JSON Crack */}
      <div
        className='flex items-center gap-1.5 px-2.5 border-b border-zinc-100 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/50'
        style={{ height: 36 }}
      >
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            data.type === 'array' ? 'bg-blue-400' : 'bg-orange-400'
          )}
        />
        {/* 12px monospace 500 — matches JSONCrack node font */}
        <span
          className='font-mono font-medium text-zinc-700 dark:text-zinc-200 truncate'
          style={{ fontSize: 12 }}
        >
          {data.label || 'root'}
        </span>
        {data.childrenCount !== undefined && (
          <span
            className='ml-auto shrink-0 font-mono text-zinc-400 dark:text-zinc-500'
            style={{ fontSize: 11 }}
          >
            {data.childrenCount} items
          </span>
        )}
      </div>

      {/* ── Rows ── */}
      {/* Each row: height 30px, padding 3px 10px, nowrap+ellipsis — exact JSONCrack */}
      <div>
        {data.properties?.map((prop, idx) => (
          <div
            key={idx}
            className='flex items-center border-b border-zinc-100 dark:border-zinc-700/50 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors'
            style={{
              height: 30,
              padding: '3px 10px',
              lineHeight: '24px',
              boxSizing: 'border-box',
            }}
          >
            {/* Key */}
            <span
              className={cn(
                'shrink-0 font-mono font-medium whitespace-nowrap overflow-hidden text-ellipsis mr-1',
                keyClass
              )}
              style={{ fontSize: 14 }}
            >
              {prop.key}:{' '}
            </span>
            {/* Value */}
            <span
              className={cn(
                'font-mono font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0',
                TypeColor[prop.type] ?? valueDefaultClass
              )}
              style={{ fontSize: 14 }}
              title={prop.value}
            >
              {prop.value}
            </span>
          </div>
        ))}

        {/* Primitive value (leaf node) */}
        {data.value !== undefined && (
          <div
            className='flex items-center'
            style={{
              height: 30,
              padding: '3px 10px',
              lineHeight: '24px',
              boxSizing: 'border-box',
            }}
          >
            <span
              className={cn(
                'font-mono font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full',
                TypeColor[data.type] ?? valueDefaultClass
              )}
              style={{ fontSize: 12 }}
              title={data.value}
            >
              {data.value}
            </span>
          </div>
        )}

        {/* Empty state */}
        {(!data.properties || data.properties.length === 0) &&
          data.value === undefined && (
            <div
              className='flex items-center font-mono italic text-zinc-400 dark:text-zinc-600'
              style={{
                height: 30,
                padding: '3px 10px',
                lineHeight: '24px',
                fontSize: 11,
              }}
            >
              {/* {data.type === 'object' ? '{} empty object' : data.type === 'array' && data.childrenCount === 0 ? '[] empty array' : ''} */}
            </div>
          )}
      </div>

      <Handle
        type='source'
        position={Position.Right}
        style={{ opacity: 0, background: 'transparent', border: 'none' }}
      />
    </div>
  )
}

export default memo(JsonNode)
