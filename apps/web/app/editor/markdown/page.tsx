import { Suspense } from 'react'
import EditorPage from '../editor-page'

export default async function MarkdownEditor() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditorPage featureMode='markdown' />
    </Suspense>
  )
}
