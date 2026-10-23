import { FolderPlus } from 'lucide-react'
import { Button } from '../ui/button'
import { EmptyState } from './empty-state'
import { ProjectCard } from './project-card'
import type { Project } from '@/types/library'

export function ProjectsGrid({
  projects,
  onNewProject,
}: {
  projects: Project[]
  onNewProject: () => void
}) {
  return (
    <section className='flex flex-col gap-3.5'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='m-0 text-base font-semibold'>
          Projects{' '}
          <span className='font-medium text-[var(--jr-muted-2)]'>
            · {projects.length}
          </span>
        </h2>
        <span className='text-[13px] text-[var(--jr-muted)]'>
          Shared spaces with people and roles
        </span>
      </div>
      {projects.length === 0 ? (
        <EmptyState
          testId='projects-empty-state'
          icon={<FolderPlus size={20} />}
          title='No projects yet'
          description='Projects group files and let you invite people as Owner, Editor or Viewer.'
          action={
            <Button variant='primary' onClick={onNewProject}>
              New project
            </Button>
          }
        />
      ) : (
        <div
          data-testid='projects-grid'
          className='grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-2 max-sm:grid-cols-1'
        >
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  )
}
