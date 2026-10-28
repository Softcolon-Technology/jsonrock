import {
  getLocalDocumentBySlug,
  isPlaceholderDocumentTitle,
  type LocalDocumentType,
} from '@/lib/local-docs'
import type { RemoteFile } from '@/types/library'

/**
 * Prefer a meaningful IndexedDB title when the API still returns Untitled
 * (common for pre-Workspace shares that never stored `title`).
 */
export async function mergeLocalTitlesOntoRemote(
  files: RemoteFile[]
): Promise<RemoteFile[]> {
  if (files.length === 0) return files

  return Promise.all(
    files.map(async (file) => {
      const type = file.type as LocalDocumentType
      if (!isPlaceholderDocumentTitle(file.title, type)) return file
      try {
        const local = await getLocalDocumentBySlug(file.slug)
        const localTitle = local?.title?.trim() || ''
        if (localTitle && !isPlaceholderDocumentTitle(localTitle, type)) {
          return { ...file, title: localTitle }
        }
      } catch {
        // Keep remote title.
      }
      return file
    })
  )
}
