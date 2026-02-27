import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import EditorPage, {
  type SerializedShareLinkRecord,
} from '@/app/editor/editor-page'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function EditorSlugPage({ params }: Props) {
  const resolvedParams = await params

  let initialRecord: SerializedShareLinkRecord | null = null

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
        updatedAt: new Date(),
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
    <Suspense fallback={<div>Loading...</div>}>
      <EditorPage initialRecord={initialRecord ?? undefined} />
    </Suspense>
  )
}
