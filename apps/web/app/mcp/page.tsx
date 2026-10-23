import type { Metadata } from 'next'
import McpTokensPage from './mcp-tokens-page'

export const metadata: Metadata = {
  title: 'MCP tokens',
  description:
    'Create a JSON Rock token so Claude, Cursor, ChatGPT, and other agents can publish a shareable link.',
  robots: { index: false, follow: false },
}

export default function McpPage() {
  return <McpTokensPage />
}
