export const dynamic = 'force-static'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jsonrock.com'

  // Check if we are on the development environment
  const isDev = baseUrl.includes('https://dev.jsonrock.com')

  const body = isDev
    ? `User-agent: *
Disallow: /

Sitemap: ${baseUrl}/sitemap.xml`
    : `User-agent: *
Content-Signal: search=yes, ai-train=no, use=reference
Allow: /
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
