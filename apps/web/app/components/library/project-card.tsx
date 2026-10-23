import Link from 'next/link'
import { AvatarStack } from '../ui/avatar-stack'
import { RolePill } from '../ui/pill'
import { formatRelative, pluralize } from '@/lib/library-format'
import { projectInitials, projectTone } from '@/lib/project-tone'
import type { Project } from '@/types/library'

export function ProjectCard({ project }: { project: Project }) {
  const tone = projectTone(project.id)
  return (
    <Link
      href={`/workspace/projects/${encodeURIComponent(project.id)}`}
      data-testid={`jr-project-card-${project.id}`}
      data-project-id={project.id}
      className='flex min-w-0 cursor-pointer flex-col gap-3.5 rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-[18px] text-inherit no-underline transition-shadow hover:border-[#cbd5e1] hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jr-accent)]'
    >
      <div className='flex items-start justify-between gap-2.5'>
        <div
          className='flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-bold'
          style={{ background: tone.bg, color: tone.fg }}
          title={project.name}
          aria-label={project.name}
        >
          {projectInitials(project.name)}
        </div>
        <RolePill role={project.role} />
      </div>
      <div className='flex flex-col gap-1'>
        <div className='truncate text-[15px] font-semibold'>{project.name}</div>
        <div className='text-[13px] text-[var(--jr-muted)]'>
          {pluralize(project.fileCount, 'file')} · updated{' '}
          {formatRelative(project.updatedAt)}
        </div>
      </div>
      <div className='flex items-center justify-between'>
        <AvatarStack
          members={(project.memberPreview ?? []).map((m) => ({
            id: m.userId,
            name: m.name,
            imageUrl: m.imageUrl,
          }))}
          total={project.memberCount}
        />
        <span className='text-[13px] text-[var(--jr-muted)]'>
          {pluralize(project.memberCount, 'member')}
        </span>
      </div>
    </Link>
  )
}
