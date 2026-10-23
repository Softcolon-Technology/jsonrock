import type { ReactNode } from 'react'
import { isProjectsEnabled } from '@/lib/feature-flags'
import { WorkspaceShell } from '@/app/workspace/workspace-shell'

/**
 * Same top bar as Workspace (Workspace | MCP) when projects are enabled.
 */
export default function McpLayout({ children }: { children: ReactNode }) {
  if (!isProjectsEnabled) return <>{children}</>
  return <WorkspaceShell>{children}</WorkspaceShell>
}
