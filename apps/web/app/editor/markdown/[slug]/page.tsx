import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import EditorPage from '../../editor-page'
import { FullScreenLoader } from '../../../components/Loader'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function EditorMarkdownSlugPage({ params }: Props) {
  const resolvedParams = await params

  let initialRecord: any

  try {
    // Fetch from backend API
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/share/${resolvedParams.slug}`,
      {
        cache: 'no-store',
      }
    )

    if (res.ok) {
      const data = await res.json()

      // Backend returns { data, type, slug, isPrivate, accessType, mode }
      initialRecord = {
        slug: data.slug,
        type: data.type || 'markdown',
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
    } else {
      // Record doesn't exist - redirect to editor
      redirect('/editor')
    }
  } catch (error) {
    console.error('Error fetching share link:', error)
    redirect('/editor')
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage initialRecord={initialRecord} featureMode='markdown' />
    </Suspense>
  )
}
