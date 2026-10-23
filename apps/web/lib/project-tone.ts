const TONES = [
  { bg: '#ecfdf5', fg: '#047857' },
  { bg: '#eff6ff', fg: '#1d4ed8' },
  { bg: '#fff7ed', fg: '#c2410c' },
  { bg: '#f5f3ff', fg: '#6d28d9' },
]

/** Stable tile colours for a project, derived from its id. */
export function projectTone(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]!
}

/** "API Contracts" -> "AC", "Config" -> "CO". */
export function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}
