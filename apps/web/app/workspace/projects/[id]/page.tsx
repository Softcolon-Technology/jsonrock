import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ProjectDetailPage } from '@/app/components/projects/project-detail-page'
import { isProjectsEnabled } from '@/lib/feature-flags'

export const metadata: Metadata = {
  title: 'Project',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkspaceProjectPage({ params }: Props) {
  if (!isProjectsEnabled) redirect('/mcp')

  const { id } = await params
  const { userId, redirectToSignIn } = await auth()
  if (!userId) {
    return redirectToSignIn({
      returnBackUrl: `/workspace/projects/${encodeURIComponent(id)}`,
    })
  }

  return <ProjectDetailPage id={id} />
}
