import type { Metadata } from 'next'
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from './components/theme-provider'
import ScrollToTop from '@/components/scroll-to-top'
import Script from 'next/script'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://jsonrock.com'),
  title: {
    default: 'JsonRock',
    template: '%s | JsonRock',
  },
  description:
    'Visualize, Format, Validate and Share your JSON data instantly. Features include Graph View, Tree View, and secure sharing.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <ThemeProvider
          attribute='class'
          defaultTheme='light'
          enableSystem={false}
          disableTransitionOnChange
        >
          {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
            <>
              <Script
                async
                src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              />
              <Script id='google-analytics'>
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
                `}
              </Script>
            </>
          )}
          <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebApplication',
                name: 'JsonRock',
                url: 'https://jsonrock.com',
                description:
                  'Visualize, format, validate and share JSON data instantly with graph view, tree view, and secure sharing.',
                applicationCategory: 'DeveloperApplication',
                operatingSystem: 'Any',
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                },
                creator: {
                  '@type': 'Organization',
                  name: 'Softcolon',
                  url: 'https://www.softcolon.com',
                },
              }),
            }}
          />
          <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Softcolon',
                url: 'https://www.softcolon.com',
                logo: 'https://jsonrock.com/jsonrock-dark.svg',
                sameAs: [
                  'https://www.instagram.com/softcolon/',
                  'https://www.linkedin.com/company/softcolon/',
                ],
              }),
            }}
          />
          {children}
          <ScrollToTop />
        </ThemeProvider>
      </body>
    </html>
  )
}
