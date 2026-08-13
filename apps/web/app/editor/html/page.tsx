import type { Metadata } from 'next'
import { Suspense } from 'react'
import EditorPage from '../editor-page'
import { FullScreenLoader } from '../../components/Loader'

export const metadata: Metadata = {
  title: 'HTML Viewer — Preview HTML Code in Real-Time',
  description:
    'Paste HTML code and see a live preview instantly. Supports safe mode for scripts, CSS, and full HTML5.',
  alternates: {
    canonical: 'https://jsonrock.com/editor/html',
  },
  openGraph: {
    title: 'HTML Viewer | JsonRock',
    description:
      'Paste HTML code and see a live preview instantly. Supports safe mode for scripts, CSS, and full HTML5.',
    url: 'https://jsonrock.com/editor/html',
    siteName: 'JsonRock',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JsonRock HTML Viewer',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HTML Viewer | JsonRock',
    description:
      'Paste HTML code and see a live preview instantly. Supports safe mode for scripts, CSS, and full HTML5.',
    images: ['/og-image.png'],
  },
}

export default async function HtmlEditorPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage featureMode='html' />
    </Suspense>
  )
}
