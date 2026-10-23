import {
  normalizeInvite,
  normalizeProject,
  type InviteRole,
  type Project,
  type ProjectDetail,
  type ProjectInvite,
  type Role,
} from '@/types/library'
import { apiFetch, type TokenGetter } from './client'

const enc = encodeURIComponent

export async function listProjects(getToken: TokenGetter) {
  const raw = await apiFetch<{ projects?: Project[] } | Project[]>(
    '/projects',
    { getToken }
  )
  const list = Array.isArray(raw) ? raw : (raw.projects ?? [])
  return { projects: list.map(normalizeProject) }
}

export async function createProject(getToken: TokenGetter, name: string) {
  const raw = await apiFetch<{ project: Project }>('/projects', {
    method: 'POST',
    body: { name },
    getToken,
  })
  return { project: normalizeProject(raw.project) }
}

export async function getProject(
  getToken: TokenGetter,
  id: string
): Promise<ProjectDetail> {
  const raw = await apiFetch<{
    project: Project
    files?: ProjectDetail['files']
    members?: ProjectDetail['members']
    pendingInvites?: ProjectInvite[]
    invites?: ProjectInvite[]
    myRole?: Role
  }>(`/projects/${enc(id)}`, { getToken })

  const project = normalizeProject(raw.project)
  const pending = (raw.pendingInvites ?? raw.invites ?? [])
    .map(normalizeInvite)
    .filter((i): i is ProjectInvite => !!i)

  return {
    project,
    files: raw.files ?? [],
    members: raw.members ?? [],
    pendingInvites: pending,
    invites: pending,
    myRole: raw.myRole ?? project.myRole,
  }
}

export function renameProject(getToken: TokenGetter, id: string, name: string) {
  return apiFetch<{ project: Project }>(`/projects/${enc(id)}`, {
    method: 'PATCH',
    body: { name },
    getToken,
  })
}

export function deleteProject(getToken: TokenGetter, id: string) {
  return apiFetch<{ ok?: boolean }>(`/projects/${enc(id)}`, {
    method: 'DELETE',
    getToken,
  })
}

export function inviteToProject(
  getToken: TokenGetter,
  id: string,
  email: string,
  role: InviteRole
) {
  return apiFetch<{ invite: ProjectInvite }>(`/projects/${enc(id)}/invites`, {
    method: 'POST',
    body: { email, role },
    getToken,
  })
}

/** DELETE /api/projects/:id/invites/:token — revoke (owner). */
export function revokeInvite(
  getToken: TokenGetter,
  projectId: string,
  token: string
) {
  return apiFetch<{ ok?: boolean }>(
    `/projects/${enc(projectId)}/invites/${enc(token)}`,
    { method: 'DELETE', getToken }
  )
}

export function updateMemberRole(
  getToken: TokenGetter,
  projectId: string,
  userId: string,
  role: Exclude<Role, 'owner'>
) {
  return apiFetch<{ ok?: boolean }>(
    `/projects/${enc(projectId)}/members/${enc(userId)}`,
    { method: 'PATCH', body: { role }, getToken }
  )
}

export function removeMember(
  getToken: TokenGetter,
  projectId: string,
  userId: string
) {
  return apiFetch<{ ok?: boolean }>(
    `/projects/${enc(projectId)}/members/${enc(userId)}`,
    { method: 'DELETE', getToken }
  )
}
