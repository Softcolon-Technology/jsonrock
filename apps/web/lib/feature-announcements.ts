export type FeatureAnnouncement = {
  id: string
  eyebrow?: string
  title: string
  message: string
  highlights?: string[]
  imageSrc?: string
  imageAlt?: string
  ctaLabel?: string
  ctaHref?: string
  active: boolean
}

export const FEATURE_ANNOUNCEMENTS: FeatureAnnouncement[] = [
  {
    id: 'mcp-integration-2026-09',
    eyebrow: 'New feature',
    title: 'Give your AI agents a way to publish.',
    message:
      'Connect Cursor, Claude Code or any AI Agent that supports MCP to JSON Rock. Your agent can turn JSON, text, Markdown with Mermaid, or HTML into one encrypted, shareable link.',
    highlights: ['Encrypted content', '6 agent tools', 'Hosted HTTP server'],
    imageSrc: '/mcp.png',
    imageAlt: 'MCP',
    ctaLabel: 'Set up MCP tokens',
    ctaHref: '/account/mcp',
    active: true,
  },
]
