import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import EditorPage from '@/app/editor/editor-page'
import { FullScreenLoader } from '@/app/components/Loader'
import { isProjectsEnabled } from '@/lib/feature-flags'
import { loadShareRecord } from '@/lib/load-share-record'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ id: string; slug: string }>
}

export default async function WorkspaceProjectHtmlFilePage({ params }: Props) {
  if (!isProjectsEnabled) redirect('/editor/html')
  const { slug } = await params
  const initialRecord = await loadShareRecord(slug, 'html')

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage initialRecord={initialRecord as any} featureMode='html' />
    </Suspense>
  )
}
