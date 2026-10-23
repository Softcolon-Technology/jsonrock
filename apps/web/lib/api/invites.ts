import { normalizeInvite, type ProjectInvite } from '@/types/library'
import { apiFetch, type TokenGetter } from './client'

const enc = encodeURIComponent

/** GET /api/projects/invites/pending → ProjectInvite[] for my email. */
export async function listPendingInvites(
  getToken: TokenGetter
): Promise<{ invites: ProjectInvite[] }> {
  const raw = await apiFetch<ProjectInvite[] | { invites?: ProjectInvite[] }>(
    '/projects/invites/pending',
    { getToken }
  )

  const list = Array.isArray(raw) ? raw : (raw.invites ?? [])
  return {
    invites: list.map(normalizeInvite).filter((i): i is ProjectInvite => !!i),
  }
}

/** GET /api/projects/invites/:token — preview an invite before accepting. */
export async function getInviteByToken(getToken: TokenGetter, token: string) {
  const raw = await apiFetch<{ invite?: ProjectInvite } | ProjectInvite>(
    `/projects/invites/${enc(token)}`,
    { getToken }
  )
  const candidate =
    raw && typeof raw === 'object' && 'invite' in raw && raw.invite
      ? raw.invite
      : (raw as ProjectInvite)
  const invite = normalizeInvite({
    ...candidate,
    token: candidate.token ?? token,
  })
  if (!invite) throw new Error('Invite not found')
  return { invite }
}

/** POST /api/projects/invites/:token/accept */
export function acceptInvite(getToken: TokenGetter, token: string) {
  return apiFetch<{ projectId: string }>(
    `/projects/invites/${enc(token)}/accept`,
    { method: 'POST', getToken }
  )
}

/** POST /api/projects/invites/:token/decline */
export function declineInvite(getToken: TokenGetter, token: string) {
  return apiFetch<{ ok?: boolean }>(`/projects/invites/${enc(token)}/decline`, {
    method: 'POST',
    getToken,
  })
}
