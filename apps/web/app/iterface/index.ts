export type ShareType = 'json' | 'text' | 'markdown' | 'html'

export function getEditorBasePath(type: ShareType): string {
  switch (type) {
    case 'text':
      return '/editor/text'
    case 'markdown':
      return '/editor/markdown'
    case 'html':
      return '/editor/html'
    default:
      return '/editor'
  }
}
