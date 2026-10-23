/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['react-icons'],
  },
  async redirects() {
    return [
      // MCP tokens live at /mcp (not nested under /workspace).
      {
        source: '/workspace/mcp',
        destination: '/mcp',
        permanent: true,
      },
      {
        source: '/account/mcp',
        destination: '/mcp',
        permanent: true,
      },
      // Legacy /account → /workspace (invite emails, bookmarks).
      {
        source: '/account',
        destination: '/workspace',
        permanent: true,
      },
      {
        source: '/account/:path*',
        destination: '/workspace/:path*',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
