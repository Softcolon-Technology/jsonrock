import { Suspense } from 'react'
import EditorPage from './editor-page'
import { FullScreenLoader } from '../components/Loader'

export default async function Editor() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage />
    </Suspense>
  )
}
