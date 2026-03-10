import ELK, { ElkNode, ElkPrimitiveEdge } from 'elkjs/lib/elk.bundled'
import { Edge, Node } from 'reactflow'

const elk = new ELK()

// Layout options for a clean Left-to-Right graph
const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '180',
  'elk.spacing.nodeNode': '100', // Vertical gap
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

export type GraphNodeData = {
  label: string
  type: string
  isPrimitive?: boolean
  value?: string
  objectKey?: string // The key in the parent object
  childrenCount?: number
  properties?: { key: string; value: string; type: string }[]
  path?: string
  content?: any
}

// Helper to identify type
const getType = (value: any): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const getStringValue = (value: any): string => {
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) return `[${value.length}]`
    return `{${Object.keys(value).length}}`
  }
  return String(value)
}

export const getLayoutedElements = async (json: any) => {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Temporary storage for ELK
  // Use explicit casting to avoid type errors in this environment if types aren't perfect
  const elkNodes: ElkNode[] = []
  const elkEdges: ElkPrimitiveEdge[] = []

  let nodeIdCounter = 0

  // Recursive function to build graph
  const traverse = (
    key: string,
    value: any,
    parentId?: string,
    edgeLabel?: string,
    currentPath: string = '$'
  ) => {
    const nodeId = `n-${nodeIdCounter++}`
    const type = getType(value)

    // Prepare node data
    const nodeData: GraphNodeData = {
      label: key || 'root',
      type,
      objectKey: edgeLabel,
      path: currentPath,
      content: value,
    }

    let isComplex = false
    const width = 220 // estimated width
    let height = 60 // initial height estimate

    if (type === 'object' && value !== null) {
      isComplex = true
      nodeData.properties = []
      // Extract Primitives
      Object.entries(value).forEach(([k, v]) => {
        if (getType(v) !== 'object' && getType(v) !== 'array') {
          nodeData.properties?.push({
            key: k,
            value: getStringValue(v),
            type: getType(v),
          })
        }
      })

      // Calculate height based on properties
      // Base header ~40px, each row ~24px
      height = 40 + (nodeData.properties?.length || 0) * 28 + 10
    } else if (type === 'array') {
      isComplex = true
      nodeData.childrenCount = value.length
      nodeData.label = key
        ? `${key} [${value.length}]`
        : `Array [${value.length}]`
    } else {
      // Single primitive root or value
      nodeData.value = getStringValue(value)
    }

    // Add to ELK nodes
    elkNodes.push({
      id: nodeId,
      width,
      height,
    })

    // Add to ReactFlow nodes (position will be updated later)
    nodes.push({
      id: nodeId,
      data: nodeData,
      position: { x: 0, y: 0 },
      type: 'jsonNode', // Custom node type
    })

    // Create Edge from Parent
    if (parentId) {
      const edgeId = `e-${parentId}-${nodeId}`
      elkEdges.push({
        id: edgeId,
        source: parentId,
        target: nodeId,
      })
      edges.push({
        id: edgeId,
        source: parentId,
        target: nodeId,
        label: edgeLabel,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#52525b', strokeWidth: 1.5 },
        labelStyle: { fill: '#a1a1aa', fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: 'transparent', fillOpacity: 0.8 } as any,
      })
    }

    // Traverse Children
    if (isComplex) {
      if (type === 'object') {
        Object.entries(value).forEach(([k, v]) => {
          // Only traverse complex types (objects/arrays) as new nodes. Primitives are already in 'properties'.
          if (getType(v) === 'object' || getType(v) === 'array') {
            // Path construction for object: currentPath.key
            // Handle special characters in keys if needed, but simple dot notation for now
            // If key implies it needs brackets, use brackets, but simple assumption:
            const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
              ? `${currentPath}.${k}`
              : `${currentPath}["${k}"]`
            traverse(k, v, nodeId, k, nextPath)
          }
        })
      } else if (type === 'array') {
        value.forEach((item: any, index: number) => {
          // Path construction for array: currentPath[index]
          const nextPath = `${currentPath}[${index}]`
          traverse(`${index}`, item, nodeId, undefined, nextPath)
        })
      }
    }
  }

  traverse('', json, undefined, undefined, '$')

  const graph: ElkNode = {
    id: 'root',
    layoutOptions,
    children: elkNodes,
    edges: elkEdges as any,
  }

  try {
    const layoutedGraph = await elk.layout(graph)

    // sync positions
    layoutedGraph.children?.forEach((node) => {
      const matchingNode = nodes.find((n) => n.id === node.id)
      if (matchingNode) {
        matchingNode.position = {
          x: node.x || 0,
          y: node.y || 0,
        }
      }
    })

    return { nodes, edges }
  } catch (e) {
    console.error('Layout failed', e)
    return { nodes, edges } // Return unlayouted on error
  }
}
