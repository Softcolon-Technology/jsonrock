'use client'

import { Cloud } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { RemoteFileRow } from './remote-file-row'
import { Button } from '../../ui/button'
import { RolePill } from '../../ui/pill'
import { pluralize } from '@/lib/library-format'
import type { RemoteLibrary } from '@/hooks/use-remote-file'
import type { Project, RemoteFile } from '@/types/library'

export interface RemoteFilesTabProps {
  library: RemoteLibrary
  loading: boolean
  error: string | null
  isSignedIn: boolean
  query: string
  activeSlug: string | null
  /** Slugs that also exist in this browser's IndexedDB. */
  localSlugs: Set<string>
  onRetry: () => void
  onSignIn: () => void
  onOpenFile: () => void
  onRename: (file: RemoteFile, title: string) => Promise<void>
  onMove: (file: RemoteFile) => void
  onCopyLink: (file: RemoteFile) => void
  onDelete: (file: RemoteFile) => void
}

const GROUP_LABEL =
  'text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--jr-muted)]'

function Notice({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className='flex min-h-[240px] flex-col items-center justify-center gap-2 px-6 text-center'>
      <Cloud
        size={28}
        className='text-[var(--jr-muted-2)]'
        aria-hidden='true'
      />
      <p className='m-0 text-sm font-semibold'>{title}</p>
      {body && (
        <p className='m-0 max-w-sm text-xs text-[var(--jr-muted)]'>{body}</p>
      )}
      {action}
    </div>
  )
}

export function RemoteFilesTab({
  library,
  loading,
  error,
  isSignedIn,
  query,
  activeSlug,
  localSlugs,
  onRetry,
  onSignIn,
  onOpenFile,
  onRename,
  onMove,
  onCopyLink,
  onDelete,
}: RemoteFilesTabProps) {
  const q = query.trim().toLowerCase()

  const { standalone, groups, total } = useMemo(() => {
    const match = (f: RemoteFile) => !q || f.title.toLowerCase().includes(q)
    const standalone = library.standalone.filter(match)
    const groups = library.groups
      .map((g) => ({ project: g.project, files: g.files.filter(match) }))
      // While searching, hide groups with no hits; otherwise show every project.
      .filter((g) => !q || g.files.length > 0)
    const total =
      standalone.length + groups.reduce((n, g) => n + g.files.length, 0)
    return { standalone, groups, total }
  }, [library, q])

  if (!isSignedIn) {
    return (
      <Notice
        title='Sign in to see your remote files'
        body='Files you saved to your account, plus your projects, show up here.'
        action={
          <Button variant='primary' size='sm' onClick={onSignIn}>
            Sign in
          </Button>
        }
      />
    )
  }
  if (loading && library.standalone.length + library.groups.length === 0) {
    return <Notice title='Loading remote files…' />
  }
  if (error) {
    return (
      <Notice
        title='Could not load remote files'
        body={error}
        action={
          <Button variant='secondary' size='sm' onClick={onRetry}>
            Try again
          </Button>
        }
      />
    )
  }
  if (total === 0 && groups.length === 0) {
    return (
      <Notice
        title={
          q ? `No remote files match “${query.trim()}”` : 'No remote files yet'
        }
        body={
          q
            ? undefined
            : 'Save a document to your account or add it to a project and it will appear here.'
        }
      />
    )
  }

  const row = (file: RemoteFile, inProject: boolean) => (
    <RemoteFileRow
      key={file.slug}
      file={file}
      inProject={inProject}
      isActive={file.slug === activeSlug}
      onDevice={localSlugs.has(file.slug)}
      onOpen={onOpenFile}
      onRename={onRename}
      onMove={onMove}
      onCopyLink={onCopyLink}
      onDelete={onDelete}
    />
  )

  return (
    <div className='pb-1'>
      {(standalone.length > 0 || !q) && (
        <>
          <div className={`px-5 pb-1.5 pt-2.5 ${GROUP_LABEL}`}>
            Standalone · {standalone.length}
          </div>
          {standalone.length === 0 ? (
            <p className='m-0 px-5 pb-3 text-xs text-[var(--jr-muted)]'>
              No standalone files.
            </p>
          ) : (
            standalone.map((f) => row(f, false))
          )}
        </>
      )}
      {groups.map((g) => (
        <ProjectGroup
          key={g.project.id}
          project={g.project}
          count={g.files.length}
        >
          {g.files.length === 0 ? (
            <p className='m-0 px-5 pb-3 text-xs text-[var(--jr-muted)]'>
              {pluralize(0, 'file')} in this project.
            </p>
          ) : (
            g.files.map((f) => row(f, true))
          )}
        </ProjectGroup>
      ))}
    </div>
  )
}

function ProjectGroup({
  project,
  count,
  children,
}: {
  project: Project
  count: number
  children: React.ReactNode
}) {
  return (
    <section aria-label={project.name}>
      <div className='flex items-center justify-between px-5 pb-1.5 pt-3.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className={`truncate ${GROUP_LABEL}`}>
            {project.name} · {count}
          </span>
          <RolePill role={project.role} />
        </div>
        <Link
          href={`/workspace/projects/${encodeURIComponent(project.id)}`}
          className='shrink-0 text-[13px] font-semibold text-[var(--jr-accent-hover)] no-underline hover:underline'
        >
          Open project
        </Link>
      </div>
      {children}
    </section>
  )
}
