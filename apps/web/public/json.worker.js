// =============================================================================
// json.worker.js — off-thread JSON processing for JSONRock
// Handles: JSON.parse, graph topology traversal, tree node building
// Main thread handles: ELK layout (already async), React rendering
// =============================================================================

// ── Constants (must match graph-layout.ts exactly) ───────────────────────────
const ROW_HEIGHT = 30
const PARENT_HEIGHT = 36
const MAX_NODE_WIDTH = 700
const MIN_NODE_WIDTH = 45
const TRUNCATE_DISPLAY = 50 // chars before … in displayed value
const TRUNCATE_MEASURE = 80 // chars used for width estimation

// ── Type helpers ─────────────────────────────────────────────────────────────
function getType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function getStringValue(value) {
  if (value === null) return 'null'
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.length} items]`
    return `{${Object.keys(value).length} keys}`
  }
  return String(value)
}

// ── Width estimation (no DOM in workers — character-count approximation) ─────
// ui-monospace at 12px/weight-500 ≈ 8.3px per character + 24px padding
function estimateTextWidth(text) {
  return Math.min(
    MAX_NODE_WIDTH,
    Math.max(MIN_NODE_WIDTH, text.length * 8.3 + 24)
  )
}

function calcNodeSize(rows, singleText) {
  if (singleText !== undefined) {
    // Header row (array label or primitive)
    const w = Math.min(
      MAX_NODE_WIDTH,
      estimateTextWidth(singleText.slice(0, TRUNCATE_MEASURE)) + 80
    )
    return { width: w, height: PARENT_HEIGHT }
  }
  if (rows.length === 0) {
    return { width: 150, height: PARENT_HEIGHT + ROW_HEIGHT }
  }
  let maxWidth = MIN_NODE_WIDTH
  for (const { key, value } of rows) {
    const rowText = `${key}: ${value.slice(0, TRUNCATE_MEASURE)}`
    const w = estimateTextWidth(rowText)
    if (w > maxWidth) maxWidth = w
  }
  return {
    width: Math.min(MAX_NODE_WIDTH, maxWidth),
    height: PARENT_HEIGHT + rows.length * ROW_HEIGHT,
  }
}

// ── Layout options (returned to main thread for ELK) ─────────────────────────
const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '140',
  'elk.spacing.nodeNode': '80',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

// ── Main processing function ──────────────────────────────────────────────────
function processJson(json) {
  const rfNodes = [] // React Flow nodes (without positions — set after ELK on main thread)
  const rfEdges = [] // React Flow edges
  const elkNodes = [] // ELK-format nodes (id + width + height)
  const elkEdges = [] // ELK-format edges (id + source + target)
  const treeNodes = [] // flat list for VirtualizedTree

  let nodeIdCounter = 0
  let treeIdCounter = 0

  // ── Tree node builder ────────────────────────────────────────────────────
  // We build a flat sorted list — order matches DFS traversal.
  // VirtualizedTree filters by expandedIds on the client.
  function addTreeNode(key, value, type, depth, parentTreeId) {
    const treeId = `t-${treeIdCounter++}`
    const childCount =
      type === 'array'
        ? value.length
        : type === 'object' && value !== null
          ? Object.keys(value).length
          : 0

    let displayValue
    if (type === 'object' && value !== null)
      displayValue = `{${childCount} keys}`
    else if (type === 'array') displayValue = `[${childCount} items]`
    else {
      const sv = getStringValue(value)
      displayValue =
        sv.length > TRUNCATE_DISPLAY ? sv.slice(0, TRUNCATE_DISPLAY) + '…' : sv
    }

    treeNodes.push({
      id: treeId,
      parentId: parentTreeId,
      key: key !== '' ? key : '(root)',
      value: displayValue,
      type,
      depth,
      hasChildren: childCount > 0,
      childCount,
      // Default: expand depth 0 and 1 automatically
      isInitiallyExpanded: depth < 2,
    })

    return treeId
  }

  // ── Graph node traversal ─────────────────────────────────────────────────
  function traverse(key, value, isRoot, currentPath, parentTreeId, treeDepth) {
    const nodeId = `n-${nodeIdCounter++}`
    const type = getType(value)

    const nodeData = {
      label: key || 'root',
      type,
      objectKey: key || undefined,
      path: currentPath,
      content: value, // Restored for NodeModal functionality
      isRoot,
      hasOutgoing: false,
      sourceHandlePositions: undefined,
    }

    let width = MIN_NODE_WIDTH
    let height = PARENT_HEIGHT
    const complexChildren = []

    // ── Build tree node for this level ──────────────────────────────────
    const treeId = addTreeNode(key, value, type, treeDepth, parentTreeId)

    if (type === 'object' && value !== null) {
      nodeData.properties = []
      const primitiveRows = []

      Object.entries(value).forEach(([k, v]) => {
        const vType = getType(v)
        if (vType !== 'object' && vType !== 'array') {
          const strVal = getStringValue(v)
          const displayVal =
            strVal.length > TRUNCATE_DISPLAY
              ? strVal.slice(0, TRUNCATE_DISPLAY) + '…'
              : strVal
          nodeData.properties.push({ key: k, value: displayVal, type: vType })
          primitiveRows.push({ key: k, value: strVal })
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

      const size = calcNodeSize(primitiveRows)
      width = size.width
      height = size.height
      nodeData.hasOutgoing = complexChildren.length > 0
    } else if (type === 'array') {
      nodeData.childrenCount = value.length
      nodeData.label = key
        ? `${key} [${value.length}]`
        : `Array [${value.length}]`

      const size = calcNodeSize([], nodeData.label)
      width = size.width
      height = value.length === 0 ? PARENT_HEIGHT + ROW_HEIGHT : PARENT_HEIGHT
      nodeData.hasOutgoing = value.length > 0

      value.forEach((item, index) => {
        const nextPath = `${currentPath}[${index}]`
        complexChildren.push({
          key: String(index),
          value: item,
          edgeLabel: undefined,
          path: nextPath,
        })
      })
    } else {
      // Primitive leaf
      const strVal = getStringValue(value)
      nodeData.value =
        strVal.length > TRUNCATE_DISPLAY
          ? strVal.slice(0, TRUNCATE_DISPLAY) + '…'
          : strVal
      const size = calcNodeSize(
        [],
        `${key ? key + ': ' : ''}${strVal.slice(0, TRUNCATE_MEASURE)}`
      )
      width = size.width
      height = PARENT_HEIGHT
    }

    // Push to React Flow and ELK node lists
    rfNodes.push({
      id: nodeId,
      type: 'jsonNode',
      data: nodeData,
      position: { x: 0, y: 0 }, // positions applied after ELK on main thread
    })
    elkNodes.push({ id: nodeId, width, height })

    // ── Recurse into children, build edges ───────────────────────────────
    if (complexChildren.length > 0) {
      const childIds = complexChildren.map((child) =>
        traverse(
          child.key,
          child.value,
          false,
          child.path,
          treeId,
          treeDepth + 1
        )
      )

      // Fan-out source handles: evenly spread within [0%, 100%] of node height
      if (childIds.length > 1) {
        nodeData.sourceHandlePositions = childIds.map((_, i) => ({
          id: `${nodeId}-sh-${i}`,
          topPercent: ((i + 1) / (childIds.length + 1)) * 100,
        }))
      }

      childIds.forEach((childId, i) => {
        const edgeId = `e-${nodeId}-${childId}`
        const sourceHandle =
          childIds.length > 1 ? `${nodeId}-sh-${i}` : undefined

        elkEdges.push({ id: edgeId, source: nodeId, target: childId })
        rfEdges.push({
          id: edgeId,
          source: nodeId,
          target: childId,
          ...(sourceHandle ? { sourceHandle } : {}),
          label: complexChildren[i]?.edgeLabel,
          type: 'custom',
          animated: false,
          style: { stroke: '#a1a1aa', strokeWidth: 1.5 },
          labelStyle: { fill: '#a1a1aa', fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: 'transparent' },
        })
      })
    }

    return nodeId
  }

  // ── Skip empty root wrapper (object with only complex children) ──────────
  const shouldSkipRoot =
    json !== null &&
    typeof json === 'object' &&
    !Array.isArray(json) &&
    Object.values(json).length > 0 &&
    Object.values(json).every((v) => {
      const t = getType(v)
      return t === 'object' || t === 'array'
    })

  if (shouldSkipRoot) {
    Object.entries(json).forEach(([k, v]) => {
      const path = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? `$.${k}` : `$["${k}"]`
      traverse(k, v, true, path, null, 0)
    })
  } else {
    traverse('', json, true, '$', null, 0)
  }

  return {
    rfNodes,
    rfEdges,
    elkNodes,
    elkEdges,
    treeNodes,
    layoutOptions: LAYOUT_OPTIONS,
  }
}

// ── Worker message handler ────────────────────────────────────────────────────
self.onmessage = function (e) {
  const { type, payload, requestId } = e.data

  if (type === 'PROCESS_JSON') {
    try {
      const json = JSON.parse(payload)
      const result = processJson(json)
      self.postMessage({ type: 'RESULT', requestId, payload: result })
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        requestId,
        payload: { error: err.message || 'JSON parse failed' },
      })
    }
  }
}
