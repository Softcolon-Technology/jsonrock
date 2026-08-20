import type { Metadata } from 'next'
import { Suspense } from 'react'
import EditorPage from '../../editor-page'
import { FullScreenLoader } from '../../../components/Loader'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

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
        schemaVersion: data.schemaVersion || (data.isLegacyPlaintext ? 1 : 2),
        isLegacyPlaintext: data.isLegacyPlaintext || false,
        json: data.isLegacyPlaintext
          ? typeof data.data === 'string'
            ? data.data
            : JSON.stringify(data.data)
          : data.json || '',
        ciphertext: data.ciphertext || '',
        iv: data.iv || '',
        salt: data.salt || undefined,
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
