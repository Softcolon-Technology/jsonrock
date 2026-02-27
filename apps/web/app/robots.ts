import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jsonrock.com'

    // Check if we are on the development environment
    const isDev = baseUrl.includes('https://dev.jsonrock.com')

    return {
        rules: {
            userAgent: '*',
            // If dev, allow nothing. If prod, allow everything.
            allow: isDev ? undefined : '/',
            // If dev, disallow everything. If prod, disallow only api.
            disallow: isDev ? '/' : '/api/',
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}

