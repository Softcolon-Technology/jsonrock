// ─── Diff Stats Web Worker ───────────────────────────────────────────────────
// Runs off the main thread so large diffs never freeze the UI.
// Uses Myers' O(ND) algorithm (fast for similar files) with a hash-based
// fallback for extremely different files.

interface DiffStats {
  additions: number
  deletions: number
  unchanged: number
}

// ─── Myers' O(ND) shortest-edit-script algorithm ─────────────────────────────
// Returns the LCS length of two string arrays.
// Time: O(ND) where D = edit distance (# of inserts + deletes).
// Space: O(D) for the frontier vector.
// For similar files (small D), this is near-linear.
function myersLCSLength(a: string[], b: string[]): number {
  const n = a.length
  const m = b.length

  if (n === 0 || m === 0) return 0

  const max = n + m

  // Bail-out: if D exceeds this threshold, use hash approximation
  // 8000 iterations × 8000 diagonals ≈ 64M ops max before bail
  const MAX_D = Math.min(max, 8000)

  const size = 2 * MAX_D + 3 // +3 for safety
  const offset = MAX_D + 1
  const v = new Int32Array(size)
  v[offset + 1] = 0

  for (let d = 0; d <= MAX_D; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) {
        x = v[offset + k + 1]! // move down (insertion)
      } else {
        x = v[offset + k - 1]! + 1 // move right (deletion)
      }
      let y = x - k

      // Follow diagonal — matching lines
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }

      v[offset + k] = x

      if (x >= n && y >= m) {
        // Edit distance = d → LCS = (n + m - d) / 2
        return (n + m - d) / 2
      }
    }
  }

  // Exceeded MAX_D — files are extremely different. Fall back to hash approx.
  return hashApproxLCS(a, b)
}

// ─── Hash-based LCS approximation ───────────────────────────────────────────
// Returns the multiset intersection size (upper bound on true LCS).
// O(M + N) time and space — always finishes fast.
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

// ─── Main diff stats computation ─────────────────────────────────────────────
function computeDiffStats(original: string, modified: string): DiffStats {
  const origLines = original.split('\n')
  const modLines = modified.split('\n')
  const M = origLines.length
  const N = modLines.length

  // ── Optimization: strip common prefix ──
  let prefixLen = 0
  const minLen = Math.min(M, N)
  while (prefixLen < minLen && origLines[prefixLen] === modLines[prefixLen]) {
    prefixLen++
  }

  // ── Optimization: strip common suffix ──
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

  // All lines match
  if (a.length === 0 && b.length === 0) {
    return { additions: 0, deletions: 0, unchanged: M }
  }

  // Only additions
  if (a.length === 0) {
    return { additions: b.length, deletions: 0, unchanged: common }
  }

  // Only deletions
  if (b.length === 0) {
    return { additions: 0, deletions: a.length, unchanged: common }
  }

  // Run Myers' on the trimmed middle section
  const middleLCS = myersLCSLength(a, b)
  const unchanged = common + middleLCS
  const deletions = M - unchanged
  const additions = N - unchanged

  return {
    additions: Math.max(0, additions),
    deletions: Math.max(0, deletions),
    unchanged: Math.max(0, unchanged),
  }
}

// ─── Worker message handler ──────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<{ original: string; modified: string }>) => {
  const { original, modified } = e.data
  const stats = computeDiffStats(original, modified)
  self.postMessage(stats)
}
