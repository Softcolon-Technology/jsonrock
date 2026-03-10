import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { GraphNodeData } from '@/lib/graph-layout'
import { cn } from '@/lib/utils'

const TypeColor = {
  string: 'text-emerald-600 dark:text-emerald-400',
  number: 'text-blue-600 dark:text-blue-400',
  boolean: 'text-rose-600 dark:text-rose-400',
  null: 'text-zinc-500 dark:text-zinc-500',
  object: 'text-zinc-600 dark:text-zinc-300',
  array: 'text-zinc-600 dark:text-zinc-300',
}

const TypeBadge = ({ type }: { type: string }) => {
  return (
    <span className='text-[9px] uppercase tracking-wider opacity-50 ml-auto font-mono'>
      {type}
    </span>
  )
}

const JsonNode = ({ data, selected }: NodeProps<GraphNodeData>) => {
  return (
    <div
      className={cn(
        'min-w-[220px] max-w-[300px] rounded-lg border bg-white dark:bg-[#09090b] shadow-xl transition-all duration-200',
        selected
          ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
          : 'border-zinc-200 dark:border-zinc-800'
      )}
    >
      <Handle
        type='target'
        position={Position.Left}
        className='!border-zinc-300 dark:!border-zinc-700 !bg-zinc-100 dark:!bg-zinc-900 w-3 h-3 -ml-1.5'
      />

      {/* Header */}
      <div className='flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30 px-3 py-2'>
        <div className='flex items-center gap-2 overflow-hidden'>
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              data.type === 'array' ? 'bg-blue-500' : 'bg-orange-500'
            )}
          />
          <span className='truncate font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200'>
            {data.label || 'Object'}
          </span>
        </div>
        {data.childrenCount !== undefined && (
          <span className='text-[10px] text-zinc-400 dark:text-zinc-500 font-mono'>
            {data.childrenCount} items
          </span>
        )}
      </div>

      {/* Body */}
      <div className='p-2 space-y-1'>
        {data.properties?.map((prop, idx) => (
          <div
            key={idx}
            className='grid grid-cols-[auto_1fr] gap-2 px-1 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 rounded py-0.5 transition-colors items-baseline'
          >
            <span className='font-mono text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap'>
              {prop.key}:
            </span>
            <span
              className={cn(
                'font-mono text-[10px] line-clamp-2 break-all whitespace-normal leading-tight',
                // @ts-ignore
                TypeColor[prop.type] || 'text-zinc-600 dark:text-zinc-300'
              )}
            >
              {prop.value}
            </span>
          </div>
        ))}
        {data.value && (
          <div className='flex items-center gap-2 px-1'>
            <span
              className={cn(
                'font-mono text-xs line-clamp-2 break-all whitespace-normal leading-tight',
                // @ts-ignore
                TypeColor[data.type] || 'text-zinc-600 dark:text-zinc-300'
              )}
            >
              {data.value}
            </span>
          </div>
        )}

        {(!data.properties || data.properties.length === 0) && !data.value && (
          <div className='px-1 py-1 text-[10px] text-zinc-400 dark:text-zinc-600 italic'>
            {data.type === 'object'
              ? '{} empty object'
              : data.type === 'array' && data.childrenCount === 0
                ? '[] empty array'
                : ''}
          </div>
        )}
      </div>

      <Handle
        type='source'
        position={Position.Right}
        className='!border-zinc-300 dark:!border-zinc-700 !bg-zinc-100 dark:!bg-zinc-900 w-3 h-3 -mr-1.5'
      />
    </div>
  )
}

export default memo(JsonNode)
