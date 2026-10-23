import type { FileLabel, RemoteFile } from '@/types/library'

/** Built-in labels every catalog should expose (must match server DEFAULT_FILE_LABELS). */
export const DEFAULT_FILE_LABEL_NAMES = [
  'docs',
  'feature',
  'bug',
  'general',
] as const

/** Merge API catalog with labels already on files so filters never miss assigned pills. */
export function mergeLabelCatalog(
  catalog: FileLabel[],
  files: RemoteFile[]
): FileLabel[] {
  const map = new Map<string, FileLabel>()
  for (const label of catalog) {
    if (label?.id) map.set(label.id, label)
  }
  for (const file of files) {
    for (const label of file.labels ?? []) {
      if (label?.id && !map.has(label.id)) map.set(label.id, label)
    }
  }
  return [...map.values()].sort((a, b) => {
    const aDefault = Boolean(a.isDefault) || isDefaultLabelName(a.name)
    const bDefault = Boolean(b.isDefault) || isDefaultLabelName(b.name)
    if (aDefault !== bDefault) return aDefault ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function isDefaultLabelName(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return (DEFAULT_FILE_LABEL_NAMES as readonly string[]).includes(lower)
}
