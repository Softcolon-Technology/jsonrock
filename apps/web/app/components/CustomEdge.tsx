'use client'
import React from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from 'reactflow'

// Hover highlight is handled via CSS in globals.css:
//   .react-flow__edge:hover .react-flow__edge-path { stroke: #22c55e }
//
// We use getBezierPath (natural S-curves) instead of getSmoothStepPath.
// Bezier curves separate visually even when edges share the same sourceX/Y —
// each edge curves toward its own targetY, creating the fan-out look matching JSONCrack.
const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#a1a1aa',
          strokeWidth: 1.5,
          transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
          ...style,
        }}
        markerEnd={markerEnd}
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              zIndex: 1000,
            }}
            className='nodrag nopan'
          >
            <span
              className='font-mono text-zinc-700 dark:text-zinc-100 bg-white dark:bg-[#1e1e1e] px-1 rounded'
              style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}
            >
              {label as string}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default CustomEdge
