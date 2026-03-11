import React, { useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  ControlButton,
  Edge,
  Node,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Panel,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import JsonNode from './JsonNode'
import CustomEdge from './CustomEdge'
import { Lock, Unlock } from 'lucide-react'

const nodeTypes = {
  jsonNode: JsonNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

interface GraphViewProps {
  nodes: Node[]
  edges: Edge[]
}

import { NodeModal } from './NodeModal'
import { GraphNodeData } from '@/lib/graph-layout'
import { cn } from '@/lib/utils'

import { useTheme } from 'next-themes'

// ...

const GraphViewContent: React.FC<GraphViewProps> = ({ nodes, edges }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [mounted, setMounted] = React.useState(false)
  const [selectedNode, setSelectedNode] = React.useState<{
    content: any
    path: string
  } | null>(null)
  const [isLocked, setIsLocked] = React.useState(false)
  const { fitView, getNode, setCenter } = useReactFlow()

  // fitView exactly ONCE on first data load — never again.
  // Zoom stays as-is when items are added or JSON changes.
  const hasFitOnce = useRef(false)

  useEffect(() => {
    if (!mounted || nodes.length === 0 || hasFitOnce.current) return
    const timer = setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 })
      hasFitOnce.current = true
    }, 50)
    return () => clearTimeout(timer)
  }, [nodes, mounted, fitView])

  useEffect(() => {
    setMounted(true)
  }, [])

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const data = node.data as GraphNodeData
    if (data.content !== undefined && data.path) {
      setSelectedNode({
        content: data.content,
        path: data.path,
      })
    }
  }, [])

  // Click on an edge → smoothly pan to the target node (like JSONCrack)
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const target = getNode(edge.target)
      if (!target) return
      const cx = target.position.x + (target.width ?? 200) / 2
      const cy = target.position.y + (target.height ?? 100) / 2
      setCenter(cx, cy, { duration: 400, zoom: 1 })
    },
    [getNode, setCenter]
  )

  if (!mounted) return null

  return (
    <div
      className={cn(
        'h-full w-full relative',
        isDark ? 'bg-zinc-950' : 'bg-gray-50'
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        // NO fitView prop — we call fitView() programmatically only on first
        // load or when the JSON root changes. This matches JSONCrack: adding
        // items keeps zoom constant; the root node moves to stay vertically
        // centered in the layout.
        minZoom={0.05}
        maxZoom={20}
        panOnDrag={!isLocked}
        zoomOnScroll={!isLocked}
        zoomOnPinch={!isLocked}
        zoomOnDoubleClick={!isLocked}
        panOnScroll={!isLocked}
        elementsSelectable={!isLocked}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
          style: { stroke: isDark ? '#52525b' : '#d4d4d8', strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements={true}
        nodesDraggable={false}
        nodesConnectable={false}
        panActivationKeyCode={null}
        zoomActivationKeyCode={isLocked ? null : 'Meta'}
      >
        <Background color={isDark ? '#18181b' : '#e4e4e7'} gap={20} size={1} />
        <Controls
          showInteractive={false}
          className={cn(
            'rounded-lg overflow-hidden shadow-xl border !flex !flex-row',

            // === LIGHT MODE (Light Grey/White Theme) ===
            '!bg-white !border-zinc-200',
            '[&>button]:!bg-white [&>button]:!border-zinc-200',
            '[&>button]:!text-zinc-700',
            '[&>button:hover]:!bg-zinc-100',
            '[&>button]:!border-b-0',
            '[&>button:not(:last-child)]:!border-r',

            // Icon Handling
            '[&_svg:not(.lucide)]:!fill-current',
            '[&_.lucide]:!stroke-current [&_.lucide]:!fill-none',

            // === DARK MODE (Dark Theme) ===
            'dark:!bg-zinc-900 dark:!border-zinc-800',
            'dark:[&>button]:!bg-zinc-900 dark:[&>button]:!border-zinc-800',
            'dark:[&>button]:!text-zinc-400 dark:[&>button:hover]:!text-zinc-200',
            'dark:[&>button:hover]:!bg-zinc-800',

            // === LOCKED STATE ===
            isLocked &&
              '[&>button:not(:last-child)]:pointer-events-none [&>button:not(:last-child)]:opacity-50'
          )}
        >
          <ControlButton
            onClick={() => setIsLocked(!isLocked)}
            title={isLocked ? 'Unlock Viewport' : 'Lock Viewport'}
          >
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </ControlButton>
        </Controls>
        <Panel
          position='bottom-right'
          className='bg-white/50 dark:bg-zinc-900/50 backdrop-blur px-4 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 text-xs text-zinc-500'
        >
          {nodes.length} nodes • {edges.length} connections
        </Panel>
      </ReactFlow>

      <NodeModal
        isOpen={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        data={selectedNode || { content: {}, path: '' }}
      />
    </div>
  )
}

export default function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphViewContent {...props} />
    </ReactFlowProvider>
  )
}
