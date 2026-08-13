import type { Metadata } from 'next'
import { Suspense } from 'react'
import EditorPage from './editor-page'
import { FullScreenLoader } from '../components/Loader'

export const metadata: Metadata = {
  title: 'JSON Editor — Visualize, Format & Validate',
  description:
    'Open the JsonRock JSON editor. Paste or upload JSON to visualize it as a graph, browse it as a tree, or format and validate it instantly.',
  alternates: {
    canonical: 'https://jsonrock.com/editor',
  },
  openGraph: {
    title: 'JSON Editor | JsonRock',
    description:
      'Paste or upload JSON to visualize it as a graph, browse it as a tree, or format and validate it instantly.',
    url: 'https://jsonrock.com/editor',
    siteName: 'JsonRock',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JsonRock JSON Editor',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JSON Editor | JsonRock',
    description:
      'Paste or upload JSON to visualize it as a graph, browse it as a tree, or format and validate it instantly.',
    images: ['/og-image.png'],
  },
}

export default async function Editor() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage />
    </Suspense>
  )
}
