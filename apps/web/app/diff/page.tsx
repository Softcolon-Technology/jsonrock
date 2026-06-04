import type { Metadata } from 'next'
import { Suspense } from 'react'
import DiffChecker from './diff-checker'
import { FullScreenLoader } from '../components/Loader'

export const metadata: Metadata = {
  title: 'Diff Checker | JsonRock',
  description:
    'Compare two code snippets side-by-side with syntax highlighting for 24+ languages. Inline diffs, local save, and works entirely in your browser.',
  keywords: [
    'diff checker',
    'code compare',
    'JSON diff',
    'text compare',
    'code difference',
    'developer tools',
    'syntax highlighting',
  ],
  openGraph: {
    title: 'JSON Diff Checker | JsonRock',
    description:
      'Compare two JSON documents side-by-side with syntax highlighting, inline diffs, and local save.',
    url: 'https://jsonrock.com/diff',
    siteName: 'JsonRock',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JsonRock Diff Checker',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JSON Diff Checker | JsonRock',
    description:
      'Compare two JSON documents side-by-side with syntax highlighting, inline diffs, and local save.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://jsonrock.com/diff',
  },
}

export default function DiffPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <DiffChecker />
    </Suspense>
  )
}
