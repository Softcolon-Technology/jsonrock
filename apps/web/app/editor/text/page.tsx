import { Suspense } from 'react'
import EditorPage from '../editor-page'

export default async function TextEditor() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditorPage featureMode='text' />
    </Suspense>
  )
}
