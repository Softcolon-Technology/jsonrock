import type { Metadata } from 'next'
import { Suspense } from 'react'
import EditorPage from '../editor-page'
import { FullScreenLoader } from '../../components/Loader'

export const metadata: Metadata = {
  title: 'Online Text Editor — Write & Share Text Instantly',
  description:
    'A minimal, fast text editor in your browser. Write, edit, and share plain text documents with a unique link. 100% free.',
  alternates: {
    canonical: 'https://jsonrock.com/editor/text',
  },
  openGraph: {
    title: 'Online Text Editor | JsonRock',
    description:
      'A minimal, fast text editor in your browser. Write, edit, and share plain text documents with a unique link.',
    url: 'https://jsonrock.com/editor/text',
    siteName: 'JsonRock',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JsonRock Text Editor',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Online Text Editor | JsonRock',
    description:
      'A minimal, fast text editor in your browser. Write, edit, and share plain text documents with a unique link.',
    images: ['/og-image.png'],
  },
}

export default async function TextEditor() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <EditorPage featureMode='text' />
    </Suspense>
  )
}
