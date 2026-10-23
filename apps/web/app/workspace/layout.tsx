import type { ReactNode } from 'react'
import { isProjectsEnabled } from '@/lib/feature-flags'
import { WorkspaceShell } from './workspace-shell'

/**
 * Workspace shell: top bar with Workspace | MCP tabs, Open editor and the Clerk
 * user menu. With the projects flag off, pages render without the shell.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  if (!isProjectsEnabled) return <>{children}</>
  return <WorkspaceShell>{children}</WorkspaceShell>
}
