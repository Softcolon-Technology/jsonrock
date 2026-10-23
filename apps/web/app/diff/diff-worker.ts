// ─── Diff Stats Web Worker ───────────────────────────────────────────────────
// Runs off the main thread so large diffs never freeze the UI.
// Uses Myers' O(ND) algorithm (fast for similar files) with a hash-based
// fallback for extremely different files.

export interface DiffStatsResult {
  id: number
  additions: number
  deletions: number
  unchanged: number
  /** True when Myers bailed out and stats used a multiset approximation. */
  approximate: boolean
}

/** Split into lines without counting a lone trailing newline as an extra line. */
function splitLines(text: string): string[] {
  if (!text) return []
  const lines = text.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function myersLCSLength(
  a: string[],
  b: string[]
): { lcs: number; approximate: boolean } {
  const n = a.length
  const m = b.length

  if (n === 0 || m === 0) return { lcs: 0, approximate: false }

  const max = n + m
  const MAX_D = Math.min(max, 8000)

  const size = 2 * MAX_D + 3
  const offset = MAX_D + 1
  const v = new Int32Array(size)
  v[offset + 1] = 0

  for (let d = 0; d <= MAX_D; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) {
        x = v[offset + k + 1]!
      } else {
        x = v[offset + k - 1]! + 1
      }
      let y = x - k

      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }

      v[offset + k] = x

      if (x >= n && y >= m) {
        return { lcs: (n + m - d) / 2, approximate: false }
      }
    }
  }

  return { lcs: hashApproxLCS(a, b), approximate: true }
}

function hashApproxLCS(a: string[], b: string[]): number {
  const freq = new Map<string, number>()
  for (const line of a) {
    freq.set(line, (freq.get(line) ?? 0) + 1)
  }

  let matched = 0
  for (const line of b) {
    const remaining = freq.get(line)
    if (remaining && remaining > 0) {
      matched++
      freq.set(line, remaining - 1)
    }
  }

  return matched
}

function computeDiffStats(
  original: string,
  modified: string
): Omit<DiffStatsResult, 'id'> {
  const origLines = splitLines(original)
  const modLines = splitLines(modified)
  const M = origLines.length
  const N = modLines.length

  let prefixLen = 0
  const minLen = Math.min(M, N)
  while (prefixLen < minLen && origLines[prefixLen] === modLines[prefixLen]) {
    prefixLen++
  }

  let suffixLen = 0
  const maxSuffix = minLen - prefixLen
  while (
    suffixLen < maxSuffix &&
    origLines[M - 1 - suffixLen] === modLines[N - 1 - suffixLen]
  ) {
    suffixLen++
  }

  const common = prefixLen + suffixLen
  const a = origLines.slice(prefixLen, M - suffixLen)
  const b = modLines.slice(prefixLen, N - suffixLen)

  if (a.length === 0 && b.length === 0) {
    return { additions: 0, deletions: 0, unchanged: M, approximate: false }
  }

  if (a.length === 0) {
    return {
      additions: b.length,
      deletions: 0,
      unchanged: common,
      approximate: false,
    }
  }

  if (b.length === 0) {
    return {
      additions: 0,
      deletions: a.length,
      unchanged: common,
      approximate: false,
    }
  }

  const { lcs: middleLCS, approximate } = myersLCSLength(a, b)
  const unchanged = common + middleLCS
  const deletions = M - unchanged
  const additions = N - unchanged

  return {
    additions: Math.max(0, additions),
    deletions: Math.max(0, deletions),
    unchanged: Math.max(0, unchanged),
    approximate,
  }
}

self.onmessage = (
  e: MessageEvent<{ id: number; original: string; modified: string }>
) => {
  const { id, original, modified } = e.data
  const stats = computeDiffStats(original, modified)
  const result: DiffStatsResult = { id, ...stats }
  self.postMessage(result)
}
