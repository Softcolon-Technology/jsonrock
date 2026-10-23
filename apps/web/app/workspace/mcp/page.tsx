import { redirect } from 'next/navigation'

/** Legacy path — MCP lives at `/mcp`. */
export default function LegacyWorkspaceMcpPage() {
  redirect('/mcp')
}
