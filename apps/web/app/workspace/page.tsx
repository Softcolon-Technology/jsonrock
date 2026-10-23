import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { InviteAcceptPage } from '@/app/components/invites/invite-accept-page'
import { LibraryPage } from '@/app/components/library/library-page'
import { isProjectsEnabled } from '@/lib/feature-flags'

export const metadata: Metadata = {
  title: 'Your library',
  description: 'Your saved files and projects on JsonRock.',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ invite?: string | string[] }>
}

export default async function WorkspacePage({ searchParams }: Props) {
  if (!isProjectsEnabled) redirect('/mcp')

  const params = await searchParams
  const invite = Array.isArray(params.invite) ? params.invite[0] : params.invite

  const { userId, redirectToSignIn } = await auth()
  if (!userId) {
    // Signed-out visitors hit sign-in first, then land back here with the
    // invite token preserved in the URL.
    return redirectToSignIn({
      returnBackUrl: invite
        ? `/workspace?invite=${encodeURIComponent(invite)}`
        : '/workspace',
    })
  }

  if (invite) return <InviteAcceptPage token={invite} />
  return <LibraryPage />
}
