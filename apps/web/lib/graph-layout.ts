import ELK, { ElkNode, ElkPrimitiveEdge } from 'elkjs/lib/elk.bundled'
import { Edge, Node } from 'reactflow'

const elk = new ELK()

// ─── Constants matching JSONCrack exactly ────────────────────────────────────
const ROW_HEIGHT = 30 // Height of each data row
const PARENT_HEIGHT = 36 // Height for header / parent label row
const MAX_NODE_WIDTH = 700
const MIN_NODE_WIDTH = 45

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.spacing.nodeNode': '80', // Increased to spread children more for better fan-out visibility
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

// Handle position info for edge fan-out:
// topPercent is the CSS `top` percentage (0–100) WITHIN the node bounds.
// Always within [0, 100] — no overflow outside the node!
export type SourceHandlePosition = {
  id: string // matches edge's sourceHandle prop
  topPercent: number // handle center at this % of node height via top: "${topPercent}%"
}

export type GraphNodeData = {
  label: string
  type: string
  isPrimitive?: boolean
  value?: string
  objectKey?: string
  childrenCount?: number
  properties?: { key: string; value: string; type: string }[]
  path?: string
  content?: any
  isRoot?: boolean // no incoming edge
  hasOutgoing?: boolean // has child nodes
  sourceHandlePositions?: SourceHandlePosition[] // fan-out handles (multi-child only)
}

// ─── Type helpers ────────────────────────────────────────────────────────────
const getType = (value: any): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const getStringValue = (value: any): string => {
  if (value === null) return 'null'
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.length} items]`
    return `{${Object.keys(value).length} keys}`
  }
  return String(value)
}

// ─── DOM-based size measurement (exactly like JSONCrack) ─────────────────────
// We measure text the same way JSONCrack does:
//  – font-size: 12px, font-weight: 500, font-family: monospace
//  – white-space: nowrap  (single line, ellipsis handled in CSS)
//  – padding: 0 10px
//  – Cap at MAX_NODE_WIDTH
// This runs ONCE per unique text string and caches the result.
const sizeCache = new Map<string, number>()

const measureTextWidth = (text: string): number => {
  if (sizeCache.has(text)) return sizeCache.get(text)!

  // During SSR there is no DOM — use character-count fallback
  if (typeof document === 'undefined') {
    const width = Math.min(
      MAX_NODE_WIDTH,
      Math.max(MIN_NODE_WIDTH, text.length * 8 + 24)
    )
    sizeCache.set(text, width)
    return width
  }

  const el = document.createElement('span')
  el.style.position = 'absolute'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  el.style.whiteSpace = 'nowrap'
  el.style.fontSize = '12px'
  el.style.fontWeight = '500'
  el.style.fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  el.style.padding = '0 10px'
  el.innerText = text
  document.body.appendChild(el)
  const width = Math.min(
    MAX_NODE_WIDTH,
    Math.max(MIN_NODE_WIDTH, el.getBoundingClientRect().width + 4)
  )
  document.body.removeChild(el)

  sizeCache.set(text, width)
  return width
}

// Clear cache every 2 minutes (like JSONCrack)
if (typeof setInterval !== 'undefined') {
  setInterval(() => sizeCache.clear(), 120_000)
}

// Calculate node dimensions from its text rows
const calcNodeSize = (
  rows: { key: string; value: string }[],
  singleText?: string
): { width: number; height: number } => {
  if (singleText !== undefined) {
    // Array header or leaf primitive — single row, measured as-is (already short)
    const truncated = singleText.slice(0, 80)
    const width = Math.min(MAX_NODE_WIDTH, measureTextWidth(truncated) + 80)
    return { width, height: PARENT_HEIGHT }
  }

  if (rows.length === 0) {
    return { width: 150, height: PARENT_HEIGHT + ROW_HEIGHT }
  }

  // *** The JSONCrack trick: slice to 80 chars when MEASURING width ***
  // Long tokens (JWT, URLs) must not inflate node width — CSS ellipsis handles display.
  let maxWidth = MIN_NODE_WIDTH
  for (const { key, value } of rows) {
    const rowText = `${key}: ${value.slice(0, 80)}` // <── 80-char cap, exactly like JSONCrack
    const w = measureTextWidth(rowText)
    if (w > maxWidth) maxWidth = w
  }

  const width = Math.min(MAX_NODE_WIDTH, maxWidth)
  const height = PARENT_HEIGHT + rows.length * ROW_HEIGHT

  return { width, height }
}

// ─── Main layout function ────────────────────────────────────────────────────
export const getLayoutedElements = async (json: any) => {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const elkNodes: ElkNode[] = []
  const elkEdges: ElkPrimitiveEdge[] = []

  let nodeIdCounter = 0

  type ChildInfo = {
    key: string
    value: any
    edgeLabel: string | undefined
    path: string
  }

  // traverse returns the created nodeId so parents can reference it.
  // The PARENT creates edges to its children (not the child creating edges to parent).
  // This way the parent knows both childIndex and total count when creating handle positions.
  const traverse = (
    key: string,
    value: any,
    isRoot: boolean,
    currentPath: string = '$'
  ): string => {
    const nodeId = `n-${nodeIdCounter++}`
    const type = getType(value)

    const nodeData: GraphNodeData = {
      label: key || 'root',
      type,
      objectKey: key || undefined,
      path: currentPath,
      content: value,
      isRoot,
      hasOutgoing: false,
    }

    let width = MIN_NODE_WIDTH
    let height = PARENT_HEIGHT
    const complexChildren: ChildInfo[] = []

    if (type === 'object' && value !== null) {
      nodeData.properties = []
      const primitiveRows: { key: string; value: string }[] = []

      Object.entries(value).forEach(([k, v]) => {
        const vType = getType(v)
        if (vType !== 'object' && vType !== 'array') {
          const strVal = getStringValue(v)
          // Truncate displayed value at 80 chars (same limit JSONCrack uses for measurement)
          const displayVal =
            strVal.length > 50 ? strVal.slice(0, 50) + '…' : strVal
          nodeData.properties!.push({ key: k, value: displayVal, type: vType })
          primitiveRows.push({ key: k, value: strVal }) // full value for width measurement
        } else {
          const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
            ? `${currentPath}.${k}`
            : `${currentPath}["${k}"]`
          complexChildren.push({
            key: k,
            value: v,
            edgeLabel: k,
            path: nextPath,
          })
        }
      })

      // Use DOM measurement to determine exact size
      const size = calcNodeSize(primitiveRows)
      width = size.width
      height = size.height
      nodeData.hasOutgoing = complexChildren.length > 0
    } else if (type === 'array') {
      nodeData.childrenCount = value.length
      nodeData.label = key
        ? `${key} [${value.length}]`
        : `Array [${value.length}]`

      // Array header: measure the label text
      const size = calcNodeSize([], nodeData.label)
      width = size.width
      height = value.length === 0 ? PARENT_HEIGHT + ROW_HEIGHT : PARENT_HEIGHT

      // Arrays always spawn child nodes (if non-empty)
      nodeData.hasOutgoing = value.length > 0
      value.forEach((item: any, index: number) => {
        const nextPath = `${currentPath}[${index}]`
        complexChildren.push({
          key: String(index),
          value: item,
          edgeLabel: undefined,
          path: nextPath,
        })
      })
    } else {
      // Primitive root or leaf — truncate display value at 80 chars
      const strVal = getStringValue(value)
      nodeData.value = strVal.length > 80 ? strVal.slice(0, 80) + '…' : strVal
      const size = calcNodeSize(
        [],
        `${key ? key + ': ' : ''}${strVal.slice(0, 80)}`
      )
      width = size.width
      height = PARENT_HEIGHT
    }

    // Push to ELK and React Flow node lists
    elkNodes.push({ id: nodeId, width, height })
    nodes.push({
      id: nodeId,
      data: nodeData,
      position: { x: 0, y: 0 },
      type: 'jsonNode',
    })

    // ── Process children and create edges ──────────────────────────────────
    if (complexChildren.length > 0) {
      // Traverse all children first to get their IDs
      const childIds = complexChildren.map((child) =>
        traverse(child.key, child.value, false, child.path)
      )

      // ── Fan-out source handle positions ────────────────────────────────
      // For parent with multiple children: distribute handles evenly across
      // node height using CSS percentages. Handles are ALWAYS within [0, 100]%
      // of the node — no overflow, no "half edges".
      //
      // Formula: topPercent = (i + 1) / (N + 1) * 100
      //   N=1: 50%  (same as default center)
      //   N=2: 33%, 67%
      //   N=3: 25%, 50%, 75%
      //   N=10: 9%, 18%, 27%, ... 91%
      if (childIds.length > 1) {
        nodeData.sourceHandlePositions = childIds.map((_, i) => ({
          id: `${nodeId}-sh-${i}`,
          topPercent: ((i + 1) / (childIds.length + 1)) * 100,
        }))
      }

      // Create ELK and React Flow edges
      childIds.forEach((childId, i) => {
        const edgeId = `e-${nodeId}-${childId}`
        const sourceHandle =
          childIds.length > 1 ? `${nodeId}-sh-${i}` : undefined

        elkEdges.push({ id: edgeId, source: nodeId, target: childId })
        edges.push({
          id: edgeId,
          source: nodeId,
          target: childId,
          ...(sourceHandle ? { sourceHandle } : {}),
          label: complexChildren[i]?.edgeLabel,
          type: 'custom',
          animated: false,
          style: { stroke: '#a1a1aa', strokeWidth: 1.5 },
          labelStyle: { fill: '#a1a1aa', fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: 'transparent' } as any,
        })
      })
    }

    return nodeId
  }

  // ── Option 1: skip the empty "root" wrapper ───────────────────────────────
  // When the root JSON is an OBJECT whose every value is a complex type
  // (array or object), there are no primitive props to display in the root
  // node — it would just render as an empty "root" box. In that case, start
  // directly from its children so the graph looks clean (like JSONCrack).
  // Examples that trigger this: { "items": [...] }, { "users": {}, "posts": [] }
  // Normal objects with at least one primitive, and plain arrays, go through
  // the standard root path and get a proper "root" / "Array [N]" node.
  const shouldSkipRoot =
    json !== null &&
    typeof json === 'object' &&
    !Array.isArray(json) &&
    Object.values(json as object).length > 0 &&
    Object.values(json as object).every((v) => {
      const t = getType(v)
      return t === 'object' || t === 'array'
    })

  if (shouldSkipRoot) {
    // Traverse each top-level key as its own root (isRoot = true for each)
    Object.entries(json as object).forEach(([k, v]) => {
      const path = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? `$.${k}` : `$["${k}"]`
      traverse(k, v, true, path)
    })
  } else {
    traverse('', json, true, '$')
  }

  const graph: ElkNode = {
    id: 'root',
    layoutOptions,
    children: elkNodes,
    edges: elkEdges as any,
  }

  try {
    const layoutedGraph = await elk.layout(graph)
    layoutedGraph.children?.forEach((node) => {
      const matchingNode = nodes.find((n) => n.id === node.id)
      if (matchingNode) {
        matchingNode.position = { x: node.x || 0, y: node.y || 0 }
      }
    })

    // ── Center root node vertically between its direct children ────────────
    // ELK places nodes from a top-based layout which can leave the root near
    // the top while children span far below. We post-process to shift the root
    // to the exact vertical midpoint of its direct children's bounding box.
    const rootNode = nodes.find((n) => n.data.isRoot)
    if (rootNode) {
      const rootEdgeTargets = edges
        .filter((e) => e.source === rootNode.id)
        .map((e) => e.target)
      const directChildren = nodes.filter((n) => rootEdgeTargets.includes(n.id))

      if (directChildren.length > 0) {
        // Get each child's ELK-computed height from elkNodes
        const elkHeightMap = new Map(
          (layoutedGraph.children ?? []).map((n) => [
            n.id,
            n.height ?? PARENT_HEIGHT,
          ])
        )
        const childTops = directChildren.map((n) => n.position.y)
        const childBottoms = directChildren.map(
          (n) => n.position.y + (elkHeightMap.get(n.id) ?? PARENT_HEIGHT)
        )
        const minTop = Math.min(...childTops)
        const maxBottom = Math.max(...childBottoms)
        const rootHeight = elkHeightMap.get(rootNode.id) ?? PARENT_HEIGHT
        // Center root at the midpoint of all children's vertical span
        rootNode.position = {
          x: rootNode.position.x,
          y: (minTop + maxBottom) / 2 - rootHeight / 2,
        }
      }
    }

    return { nodes, edges }
  } catch (e) {
    console.error('ELK Layout failed', e)
    return { nodes, edges }
  }
}

// ── Web Worker Integration ───────────────────────────────────────────────────
// This function takes the PRE-BUILT nodes and edges from the Web Worker
// and runs ELK layout on the main thread (since ELK is fast enough when
// it doesn't have to recursively build the graph itself, and importing it
// inside the worker requires external CDN scripts which can fail).
export async function applyElkLayout(
  rfNodes: Node[],
  rfEdges: Edge[],
  elkNodes: { id: string; width: number; height: number }[],
  elkEdges: { id: string; source: string; target: string }[],
  options: Record<string, string>
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (rfNodes.length === 0) return { nodes: [], edges: [] }

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: options,
    children: elkNodes,
    edges: elkEdges as any,
  }

  try {
    const layoutedGraph = await elk.layout(graph)

    // Apply ELK positions to React Flow nodes
    layoutedGraph.children?.forEach((layoutNode) => {
      const matchingNode = rfNodes.find((n) => n.id === layoutNode.id)
      if (matchingNode) {
        matchingNode.position = { x: layoutNode.x || 0, y: layoutNode.y || 0 }
      }
    })

    // ── Center root node vertically between its direct children ────────────
    const rootNode = rfNodes.find((n) => n.data.isRoot)
    if (rootNode) {
      const rootEdgeTargets = rfEdges
        .filter((e) => e.source === rootNode.id)
        .map((e) => e.target)
      const directChildren = rfNodes.filter((n) =>
        rootEdgeTargets.includes(n.id)
      )

      if (directChildren.length > 0) {
        const elkHeightMap = new Map(
          (layoutedGraph.children ?? []).map((n) => [
            n.id,
            n.height ?? PARENT_HEIGHT,
          ])
        )
        const childTops = directChildren.map((n) => n.position.y)
        const childBottoms = directChildren.map(
          (n) => n.position.y + (elkHeightMap.get(n.id) ?? PARENT_HEIGHT)
        )
        const minTop = Math.min(...childTops)
        const maxBottom = Math.max(...childBottoms)
        const rootHeight = elkHeightMap.get(rootNode.id) ?? PARENT_HEIGHT

        rootNode.position = {
          x: rootNode.position.x,
          y: (minTop + maxBottom) / 2 - rootHeight / 2,
        }
      }
    }

    return { nodes: rfNodes, edges: rfEdges }
  } catch (e) {
    console.error('ELK Layout failed', e)
    return { nodes: rfNodes, edges: rfEdges }
  }
}
