import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { InviteAcceptPage } from '@/app/components/invites/invite-accept-page'
import { isProjectsEnabled } from '@/lib/feature-flags'

export const metadata: Metadata = {
  title: 'Project invite',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ token?: string | string[] }>
}

/**
 * `/workspace/invite?token=TOKEN` — thin wrapper around the accept flow. It
 * handles the signed-out state itself (shows a sign-in prompt), while
 * `/workspace?invite=TOKEN` forces sign-in first.
 */
export default async function WorkspaceInvitePage({ searchParams }: Props) {
  if (!isProjectsEnabled) redirect('/mcp')

  const params = await searchParams
  const token = Array.isArray(params.token) ? params.token[0] : params.token
  if (!token) redirect('/workspace')

  return <InviteAcceptPage token={token} />
}
