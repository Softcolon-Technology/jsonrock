import type { Metadata } from 'next'
import { Suspense } from 'react'
import EditorPage from '../editor-page'
import { FullScreenLoader } from '../../components/Loader'

export const metadata: Metadata = {
  title: 'Markdown Editor — Write & Preview Markdown Online',
  description:
    'Write markdown with a live preview, syntax highlighting, and export options. Supports GFM, tables, and code blocks.',
  alternates: {
    canonical: 'https://jsonrock.com/editor/markdown',
  },
  openGraph: {
    title: 'Markdown Editor | JsonRock',
    description:
      'Write markdown with a live preview, syntax highlighting, and export options. Supports GFM, tables, and code blocks.',
    url: 'https://jsonrock.com/editor/markdown',
    siteName: 'JsonRock',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JsonRock Markdown Editor',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Markdown Editor | JsonRock',
    description:
      'Write markdown with a live preview, syntax highlighting, and export options. Supports GFM, tables, and code blocks.',
    images: ['/og-image.png'],
  },
}

export default async function MarkdownEditor() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage featureMode='markdown' />
    </Suspense>
  )
}
