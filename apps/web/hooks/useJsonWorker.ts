import { useEffect, useRef, useCallback, useState } from 'react'
import type { Node, Edge } from 'reactflow'

// ── Types (mirror of json.worker.js output) ───────────────────────────────────
export type TreeNodeSlim = {
  id: string
  parentId: string | null
  key: string
  value: string // display value e.g. "(3 keys)" or the scalar value
  type: string // 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  depth: number
  hasChildren: boolean
  childCount: number
  isInitiallyExpanded: boolean
}

type WorkerResult = {
  rfNodes: Node[]
  rfEdges: Edge[]
  elkNodes: { id: string; width: number; height: number }[]
  elkEdges: { id: string; source: string; target: string }[]
  treeNodes: TreeNodeSlim[]
  layoutOptions: Record<string, string>
}

type WorkerState =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'ready'; result: WorkerResult }
  | { status: 'error'; error: string }

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useJsonWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [state, setState] = useState<WorkerState>({ status: 'idle' })
  const requestIdRef = useRef(0)

  // Create worker on mount, terminate on unmount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const worker = new Worker('/json.worker.js')
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type, payload, requestId } = e.data

      // Ignore stale responses from previous requests
      if (requestId !== requestIdRef.current) return

      if (type === 'RESULT') {
        setState({ status: 'ready', result: payload as WorkerResult })
      } else if (type === 'ERROR') {
        setState({ status: 'error', error: payload.error })
      }
    }

    worker.onerror = (err) => {
      console.error('JSON worker error:', err)
      setState({ status: 'error', error: err.message || 'Worker error' })
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const processJson = useCallback((rawJson: string) => {
    if (!workerRef.current) return
    // Increment request ID — stale results from old requests will be ignored
    const reqId = ++requestIdRef.current
    setState({ status: 'processing' })
    workerRef.current.postMessage({
      type: 'PROCESS_JSON',
      payload: rawJson,
      requestId: reqId,
    })
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++ // invalidate pending responses
    setState({ status: 'idle' })
  }, [])

  return { processJson, reset, state }
}
