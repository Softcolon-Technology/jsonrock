import type { Metadata } from 'next'
import { Suspense } from 'react'
import EditorPage from '@/app/editor/editor-page'
import { FullScreenLoader } from '@/app/components/Loader'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function EditorSlugPage({ params }: Props) {
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

      initialRecord = {
        slug: data.slug,
        type: data.type || 'json',
        json: data.isPrivate
          ? ''
          : typeof data.data === 'string'
            ? data.data
            : JSON.stringify(data.data, null, 2),
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
      <EditorPage initialRecord={initialRecord} />
    </Suspense>
  )
}
