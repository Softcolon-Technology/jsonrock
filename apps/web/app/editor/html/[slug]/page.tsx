import { Suspense } from 'react'
import EditorPage from '../../editor-page'
import { FullScreenLoader } from '../../../components/Loader'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function EditorHtmlSlugPage({ params }: Props) {
  const resolvedParams = await params

  let initialRecord: any

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/share/${resolvedParams.slug}`,
      {
        cache: 'no-store',
      }
    )

    if (res.ok) {
      const data = await res.json()

      initialRecord = {
        slug: data.slug,
        type: data.type || 'html',
        json: data.isPrivate
          ? ''
          : typeof data.data === 'string'
            ? data.data
            : JSON.stringify(data.data),
        mode: data.mode || 'visualize',
        isPrivate: data.isPrivate || false,
        accessType: data.accessType || 'editor',
        createdAt: new Date().toISOString(),
      }
    }
  } catch (error) {
    console.error('Error fetching share link:', error)
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage initialRecord={initialRecord} featureMode='html' />
    </Suspense>
  )
}
