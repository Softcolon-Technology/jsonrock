import { randomBytes } from 'crypto'
import { createClerkClient, type User as ClerkUser } from '@clerk/backend'
import { Types } from 'mongoose'
import logger from '../config/logger'
import ShareLink from '../models/share.model'
import User from '../models/user.model'
import Project, { IProject } from '../models/project.model'
import ProjectMember, {
  IProjectMember,
  ProjectRole,
} from '../models/project-member.model'
import ProjectInvite, {
  IProjectInvite,
  INVITE_TTL_MS,
  InviteRole,
} from '../models/project-invite.model'
import { sendProjectInviteEmail } from './email.service'
import { emitToUser } from '../lib/socket-registry'
import { getSiteUrl } from '../mcp/urls'
import { HttpError } from '../lib/http-error'
import { labelService } from './label.service'
import FileLabel from '../models/file-label.model'

export { HttpError }

export type Role = ProjectRole

export interface FileLabelDTO {
  id: string
  name: string
  color: string
  isDefault: boolean
}

export interface RemoteFileDTO {
  slug: string
  title: string
  type: 'json' | 'text' | 'markdown' | 'html'
  updatedAt: string
  createdAt?: string
  sizeBytes?: number
  projectId: string | null
  role: Role
  shareMode: 'off' | 'link' | 'password'
  labels?: FileLabelDTO[]
}

export interface ProjectDTO {
  id: string
  name: string
  ownerId: string
  memberCount: number
  fileCount: number
  updatedAt: string
  createdAt: string
  myRole: Role
  pendingInviteCount: number
  memberPreview: { userId: string; name: string; imageUrl?: string }[]
}

export interface ProjectMemberDTO {
  userId: string
  name: string
  email: string
  role: Role
  joinedAt: string
  isYou?: boolean
  imageUrl?: string
}

export interface ProjectInviteDTO {
  token: string
  projectId: string
  projectName: string
  email: string
  role: InviteRole
  invitedByName: string
  invitedByImageUrl?: string
  createdAt: string
  expiresAt: string
}

interface FileRow {
  slug: string
  title?: string
  type?: RemoteFileDTO['type']
  ownerId?: string
  projectId?: Types.ObjectId | null
  labelIds?: Types.ObjectId[]
  isPrivate?: boolean
  createdAt?: Date
  updatedAt: Date
  sizeBytes?: number
}

interface Profile {
  name: string
  email: string
  imageUrl?: string
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const WRITE_ROLES: Role[] = ['owner', 'editor']
const PROFILE_TTL_MS = 60_000
const MEMBER_PREVIEW_LIMIT = 4
const PLACEHOLDER_EMAIL = /@users\.local$/i

const profileCache = new Map<string, { profile: Profile; at: number }>()

function getClerk(): ReturnType<typeof createClerkClient> | null {
  const secretKey = process.env.CLERK_SECRET_KEY
  return secretKey ? createClerkClient({ secretKey }) : null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseObjectId(id: string, label = 'Project'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id) || String(new Types.ObjectId(id)) !== id) {
    throw new HttpError(404, `${label} not found`)
  }
  return new Types.ObjectId(id)
}

function canWrite(role: Role | null | undefined): boolean {
  return Boolean(role && WRITE_ROLES.includes(role))
}

function clerkPrimaryEmail(user: ClerkUser): string {
  return (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    ''
  )
}

function clerkDisplayName(user: ClerkUser, email: string): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.username || email.split('@')[0] || 'Unknown'
}

function newInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Resolve display name + email for Clerk user ids. Clerk first, then the local
 * User collection. Results are cached briefly to keep list endpoints cheap.
 */
export async function resolveProfiles(
  userIds: string[]
): Promise<Map<string, Profile>> {
  const result = new Map<string, Profile>()
  const now = Date.now()
  const missing: string[] = []

  for (const id of new Set(userIds)) {
    const cached = profileCache.get(id)
    if (cached && now - cached.at < PROFILE_TTL_MS) {
      result.set(id, cached.profile)
    } else {
      missing.push(id)
    }
  }

  const clerk = getClerk()
  if (clerk && missing.length > 0) {
    for (let i = 0; i < missing.length; i += 100) {
      const chunk = missing.slice(i, i + 100)
      try {
        const { data } = await clerk.users.getUserList({
          userId: chunk,
          limit: chunk.length,
        })
        for (const user of data) {
          const email = clerkPrimaryEmail(user)
          result.set(user.id, {
            name: clerkDisplayName(user, email),
            email,
            imageUrl: user.imageUrl || undefined,
          })
        }
      } catch (error) {
        logger.warn('[projects] Clerk getUserList failed', error)
      }
    }
  }

  const stillMissing = missing.filter((id) => !result.has(id))
  if (stillMissing.length > 0) {
    const users = await User.find({ clerkId: { $in: stillMissing } })
    for (const user of users) {
      const email = PLACEHOLDER_EMAIL.test(user.email) ? '' : user.email
      result.set(user.clerkId, {
        name: user.name || email.split('@')[0] || 'Unknown',
        email,
      })
    }
  }

  for (const id of missing) {
    const profile = result.get(id) ?? { name: 'Unknown', email: '' }
    result.set(id, profile)
    profileCache.set(id, { profile, at: now })
  }

  return result
}

/**
 * All email addresses of a user, normalized, primary first.
 * Includes unverified addresses so invite accept still works right after signup.
 */
export async function getUserEmails(userId: string): Promise<string[]> {
  const emails: string[] = []
  const clerk = getClerk()

  if (clerk) {
    try {
      const user = await clerk.users.getUser(userId)
      const primary = clerkPrimaryEmail(user)
      if (primary) emails.push(normalizeEmail(primary))
      for (const address of user.emailAddresses) {
        emails.push(normalizeEmail(address.emailAddress))
      }
    } catch (error) {
      logger.warn('[projects] Clerk getUser failed', error)
    }
  }

  const local = await User.findOne({ clerkId: userId })
  if (local?.email && !PLACEHOLDER_EMAIL.test(local.email)) {
    emails.push(normalizeEmail(local.email))
  }

  return [...new Set(emails.filter(Boolean))]
}

/** Map normalized email → Clerk user id for the emails that have an account. */
async function findUserIdsByEmails(
  emails: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const wanted = [...new Set(emails.map(normalizeEmail))]
  if (wanted.length === 0) return result

  const clerk = getClerk()
  if (clerk) {
    try {
      const { data } = await clerk.users.getUserList({
        emailAddress: wanted,
        limit: wanted.length,
      })
      for (const user of data) {
        for (const address of user.emailAddresses) {
          const normalized = normalizeEmail(address.emailAddress)
          if (wanted.includes(normalized)) result.set(normalized, user.id)
        }
      }
    } catch (error) {
      logger.warn('[projects] Clerk email lookup failed', error)
    }
  }

  const unresolved = wanted.filter((e) => !result.has(e))
  if (unresolved.length > 0) {
    const users = await User.find({
      email: {
        $in: unresolved.map((e) => new RegExp(`^${escapeRegex(e)}$`, 'i')),
      },
    })
    for (const user of users) {
      result.set(normalizeEmail(user.email), user.clerkId)
    }
  }

  return result
}

function serializeInvite(
  invite: IProjectInvite,
  projectName: string,
  invitedByImageUrl?: string
): ProjectInviteDTO {
  return {
    token: invite.token,
    projectId: String(invite.projectId),
    projectName,
    email: invite.email,
    role: invite.role,
    invitedByName: invite.invitedByName,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    ...(invitedByImageUrl ? { invitedByImageUrl } : {}),
  }
}

function toRemoteFile(
  row: FileRow,
  role: Role,
  labels: FileLabelDTO[] = []
): RemoteFileDTO {
  return {
    slug: row.slug,
    title: row.title?.trim() || 'Untitled',
    type: row.type ?? 'json',
    updatedAt: row.updatedAt.toISOString(),
    ...(row.createdAt ? { createdAt: row.createdAt.toISOString() } : {}),
    ...(typeof row.sizeBytes === 'number' ? { sizeBytes: row.sizeBytes } : {}),
    projectId: row.projectId ? String(row.projectId) : null,
    role,
    shareMode: row.isPrivate ? 'password' : 'link',
    labels,
  }
}

async function labelsForRows(
  rows: FileRow[]
): Promise<Map<string, FileLabelDTO[]>> {
  const byId = await labelService.hydrateLabels(rows.map((r) => r.labelIds))
  const map = new Map<string, FileLabelDTO[]>()
  for (const row of rows) {
    const labels = (row.labelIds ?? [])
      .map((id) => byId.get(String(id)))
      .filter((l): l is FileLabelDTO => Boolean(l))
    map.set(row.slug, labels)
  }
  return map
}

/** Push a lightweight project file-list invalidation to every member. */
async function notifyProjectMembers(
  projectId: Types.ObjectId | string | null | undefined,
  payload: {
    reason: 'added' | 'updated' | 'removed' | 'moved'
    slug?: string
    file?: RemoteFileDTO
  }
): Promise<void> {
  if (!projectId) return
  const id = String(projectId)
  const members = await ProjectMember.find({ projectId })
    .select('userId')
    .lean()
  for (const m of members) {
    emitToUser(m.userId, 'project-files-changed', {
      projectId: id,
      ...payload,
    })
  }
}

/** Fetch share rows with an approximate payload size, without loading content. */
async function loadFileRows(
  match: Record<string, unknown>
): Promise<FileRow[]> {
  return ShareLink.aggregate<FileRow>([
    { $match: match },
    {
      $project: {
        slug: 1,
        title: 1,
        type: 1,
        ownerId: 1,
        projectId: 1,
        labelIds: 1,
        isPrivate: 1,
        createdAt: 1,
        updatedAt: 1,
        sizeBytes: {
          $add: [
            { $strLenBytes: { $ifNull: ['$ciphertext', ''] } },
            { $strLenBytes: { $ifNull: ['$json', ''] } },
          ],
        },
      },
    },
    { $sort: { updatedAt: -1 } },
  ])
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export class ProjectService {
  /* ----------------------------- role helpers ----------------------------- */

  async getRole(
    projectId: Types.ObjectId,
    userId: string,
    project?: IProject | null
  ): Promise<Role | null> {
    const member = await ProjectMember.findOne({ projectId, userId })
    if (member) return member.role
    const p = project ?? (await Project.findById(projectId))
    return p && p.ownerId === userId ? 'owner' : null
  }

  private async requireProject(id: string): Promise<{
    project: IProject
    projectId: Types.ObjectId
  }> {
    const projectId = parseObjectId(id)
    const project = await Project.findById(projectId)
    if (!project) throw new HttpError(404, 'Project not found')
    return { project, projectId }
  }

  /** 404 for strangers (don't leak existence), 403 for insufficient role. */
  private async requireRole(
    project: IProject,
    userId: string,
    allowed: Role[] | 'any'
  ): Promise<Role> {
    const role = await this.getRole(
      project._id as Types.ObjectId,
      userId,
      project
    )
    if (!role) throw new HttpError(404, 'Project not found')
    if (allowed !== 'any' && !allowed.includes(role)) {
      throw new HttpError(403, 'You do not have permission to do that')
    }
    return role
  }

  /* ---------------------------- project DTO build ------------------------- */

  private async buildProjectDTOs(
    projects: IProject[],
    userId: string,
    roles: Map<string, Role>
  ): Promise<ProjectDTO[]> {
    if (projects.length === 0) return []
    const ids = projects.map((p) => p._id as Types.ObjectId)

    const [members, shareStats, inviteStats] = await Promise.all([
      ProjectMember.find({ projectId: { $in: ids } }).sort({ createdAt: 1 }),
      ShareLink.aggregate<{
        _id: Types.ObjectId
        count: number
        updatedAt: Date
      }>([
        { $match: { projectId: { $in: ids } } },
        {
          $group: {
            _id: '$projectId',
            count: { $sum: 1 },
            updatedAt: { $max: '$updatedAt' },
          },
        },
      ]),
      ProjectInvite.aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            projectId: { $in: ids },
            status: 'pending',
            expiresAt: { $gt: new Date() },
          },
        },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
      ]),
    ])

    const membersByProject = new Map<string, IProjectMember[]>()
    for (const m of members) {
      const key = String(m.projectId)
      const list = membersByProject.get(key) ?? []
      list.push(m)
      membersByProject.set(key, list)
    }
    const shareByProject = new Map(shareStats.map((s) => [String(s._id), s]))
    const inviteByProject = new Map(inviteStats.map((s) => [String(s._id), s]))

    // Owners first in the avatar preview.
    const previewIds = new Map<string, string[]>()
    for (const [key, list] of membersByProject) {
      const sorted = [...list].sort(
        (a, b) => Number(b.role === 'owner') - Number(a.role === 'owner')
      )
      previewIds.set(
        key,
        sorted.slice(0, MEMBER_PREVIEW_LIMIT).map((m) => m.userId)
      )
    }
    const profiles = await resolveProfiles([...previewIds.values()].flat())

    return projects.map((project) => {
      const key = String(project._id)
      const shares = shareByProject.get(key)
      const updatedAt = new Date(
        Math.max(project.updatedAt.getTime(), shares?.updatedAt?.getTime() ?? 0)
      )
      return {
        id: key,
        name: project.name,
        ownerId: project.ownerId,
        memberCount: membersByProject.get(key)?.length ?? 0,
        fileCount: shares?.count ?? 0,
        updatedAt: updatedAt.toISOString(),
        createdAt: project.createdAt.toISOString(),
        myRole:
          roles.get(key) ?? (project.ownerId === userId ? 'owner' : 'viewer'),
        pendingInviteCount: inviteByProject.get(key)?.count ?? 0,
        memberPreview: (previewIds.get(key) ?? []).map((id) => {
          const profile = profiles.get(id)
          return {
            userId: id,
            name: profile?.name ?? 'Unknown',
            ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
          }
        }),
      }
    })
  }

  private async rolesFor(userId: string): Promise<{
    roles: Map<string, Role>
    projects: IProject[]
  }> {
    const memberships = await ProjectMember.find({ userId })
    const roles = new Map<string, Role>(
      memberships.map((m) => [String(m.projectId), m.role])
    )
    const memberIds = memberships.map((m) => m.projectId)
    const projects = await Project.find({
      $or: [{ _id: { $in: memberIds } }, { ownerId: userId }],
    })
    for (const p of projects) {
      if (!roles.has(String(p._id)) && p.ownerId === userId) {
        roles.set(String(p._id), 'owner')
      }
    }
    return { roles, projects }
  }

  /* -------------------------------- library ------------------------------- */

  async listLibrary(userId: string): Promise<{
    standalone: RemoteFileDTO[]
    projects: { project: ProjectDTO; files: RemoteFileDTO[] }[]
  }> {
    const { roles, projects } = await this.rolesFor(userId)
    const projectIds = projects.map((p) => p._id as Types.ObjectId)

    const [standaloneRows, projectRows, dtos] = await Promise.all([
      loadFileRows({ ownerId: userId, projectId: null }),
      projectIds.length
        ? loadFileRows({ projectId: { $in: projectIds } })
        : Promise.resolve([] as FileRow[]),
      this.buildProjectDTOs(projects, userId, roles),
    ])

    const labelMap = await labelsForRows([...standaloneRows, ...projectRows])

    const filesByProject = new Map<string, RemoteFileDTO[]>()
    for (const row of projectRows) {
      const key = String(row.projectId)
      const list = filesByProject.get(key) ?? []
      list.push(
        toRemoteFile(
          row,
          roles.get(key) ?? 'viewer',
          labelMap.get(row.slug) ?? []
        )
      )
      filesByProject.set(key, list)
    }

    dtos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return {
      standalone: standaloneRows.map((row) =>
        toRemoteFile(row, 'owner', labelMap.get(row.slug) ?? [])
      ),
      projects: dtos.map((project) => ({
        project,
        files: filesByProject.get(project.id) ?? [],
      })),
    }
  }

  /* -------------------------------- shares -------------------------------- */

  /**
   * Lightweight single-file lookup for the editor header (avoids loading the
   * entire library just to resolve title / project chip).
   */
  async getFileMeta(
    slug: string,
    userId: string
  ): Promise<{ file: RemoteFileDTO; project: ProjectDTO | null }> {
    const [row] = await loadFileRows({ slug })
    if (!row) throw new HttpError(404, 'File not found')

    if (row.projectId) {
      const project = await Project.findById(row.projectId)
      if (!project) throw new HttpError(404, 'File not found')
      const role = await this.requireRole(project, userId, 'any')
      const [dto] = await this.buildProjectDTOs(
        [project],
        userId,
        new Map([[String(row.projectId), role]])
      )
      return {
        file: toRemoteFile(row, role),
        project: dto ?? null,
      }
    }

    if (row.ownerId !== userId) throw new HttpError(404, 'File not found')
    return { file: toRemoteFile(row, 'owner'), project: null }
  }

  /** Role of `userId` for a share row (project role, or owner for own standalone). */
  private async fileRole(row: FileRow, userId: string): Promise<Role> {
    if (row.projectId) {
      const role = await this.getRole(row.projectId, userId)
      if (role) return role
    }
    return row.ownerId === userId ? 'owner' : 'viewer'
  }

  /** True when the user owns the share or belongs to its project. */
  async canReadShare(slug: string, userId: string): Promise<boolean> {
    const share = await ShareLink.findOne({ slug }).select('ownerId projectId')
    if (!share) return false
    if (share.ownerId && share.ownerId === userId) return true
    if (share.projectId) {
      const role = await this.getRole(share.projectId, userId)
      return Boolean(role)
    }
    return false
  }

  /** Any project member (used by label catalog reads). */
  async requireProjectMembership(projectId: string, userId: string) {
    const { project } = await this.requireProject(projectId)
    await this.requireRole(project, userId, 'any')
    return project
  }

  /** Project owner only (create/delete custom labels). */
  async requireProjectOwner(projectId: string, userId: string) {
    const { project } = await this.requireProject(projectId)
    await this.requireRole(project, userId, ['owner'])
    return project
  }

  /** Throws unless the user may edit/delete the share. Returns the share doc. */
  async requireShareWrite(slug: string, userId: string) {
    const share = await ShareLink.findOne({ slug })
    if (!share) throw new HttpError(404, 'File not found')

    if (share.ownerId && share.ownerId === userId) return share

    if (share.projectId) {
      const role = await this.getRole(share.projectId, userId)
      if (role && canWrite(role)) return share
      if (role)
        throw new HttpError(403, 'You do not have permission to edit this file')
    }
    // Hide existence of files the caller has no relationship with.
    throw new HttpError(404, 'File not found')
  }

  async patchShare(
    slug: string,
    userId: string,
    patch: { title?: string; projectId?: string | null }
  ): Promise<RemoteFileDTO> {
    const share = await this.requireShareWrite(slug, userId)
    const prevProjectId = share.projectId ? String(share.projectId) : null

    const $set: Record<string, unknown> = {}
    const $unset: Record<string, 1> = {}

    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (title) $set.title = title
      else $unset.title = 1
    }

    if (patch.projectId !== undefined) {
      if (patch.projectId === null) {
        $set.projectId = null
      } else {
        const target = await this.requireProject(patch.projectId)
        const role = await this.requireRole(target.project, userId, 'any')
        if (!canWrite(role)) {
          throw new HttpError(
            403,
            'You need editor access to add files to this project'
          )
        }
        $set.projectId = target.projectId
      }
    }

    const update: Record<string, unknown> = {}
    if (Object.keys($set).length) update.$set = $set
    if (Object.keys($unset).length) update.$unset = $unset
    if (Object.keys(update).length) {
      // Use updateOne so the share TTL / other fields are untouched.
      await ShareLink.updateOne({ _id: share._id }, update)
    }

    const [row] = await loadFileRows({ slug })
    if (!row) throw new HttpError(404, 'File not found')
    const file = toRemoteFile(row, await this.fileRole(row, userId))
    const nextProjectId = file.projectId

    if (patch.projectId !== undefined && prevProjectId !== nextProjectId) {
      // Left previous project (or was standalone).
      if (prevProjectId) {
        await notifyProjectMembers(prevProjectId, {
          reason: 'moved',
          slug,
        })
      }
      // Joined next project.
      if (nextProjectId) {
        await notifyProjectMembers(nextProjectId, {
          reason: 'added',
          slug,
          file,
        })
      }
    } else if (nextProjectId && patch.title !== undefined) {
      await notifyProjectMembers(nextProjectId, {
        reason: 'updated',
        slug,
        file,
      })
    }

    return file
  }

  async deleteShare(slug: string, userId: string): Promise<void> {
    const share = await this.requireShareWrite(slug, userId)
    const projectId = share.projectId
    await ShareLink.deleteOne({ _id: share._id })
    if (projectId) {
      await notifyProjectMembers(projectId, { reason: 'removed', slug })
    }
  }

  /* -------------------------------- projects ------------------------------ */

  async listProjects(userId: string): Promise<ProjectDTO[]> {
    const { roles, projects } = await this.rolesFor(userId)
    const dtos = await this.buildProjectDTOs(projects, userId, roles)
    return dtos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async createProject(userId: string, name: string): Promise<ProjectDTO> {
    const project = await Project.create({ name: name.trim(), ownerId: userId })
    await ProjectMember.create({
      projectId: project._id,
      userId,
      role: 'owner',
    })
    await labelService.ensureDefaults({ projectId: String(project._id) })
    const [dto] = await this.buildProjectDTOs(
      [project],
      userId,
      new Map([[String(project._id), 'owner' as Role]])
    )
    return dto as ProjectDTO
  }

  async renameProject(
    id: string,
    userId: string,
    name: string
  ): Promise<ProjectDTO> {
    const { project } = await this.requireProject(id)
    await this.requireRole(project, userId, ['owner'])
    project.name = name.trim()
    await project.save()
    const [dto] = await this.buildProjectDTOs(
      [project],
      userId,
      new Map([[String(project._id), 'owner' as Role]])
    )
    return dto as ProjectDTO
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    const { project, projectId } = await this.requireProject(id)
    await this.requireRole(project, userId, ['owner'])

    const pending = await ProjectInvite.find({ projectId, status: 'pending' })
    await Promise.all([
      ShareLink.deleteMany({ projectId }),
      ProjectMember.deleteMany({ projectId }),
      ProjectInvite.deleteMany({ projectId }),
      FileLabel.deleteMany({ projectId }),
    ])
    await Project.deleteOne({ _id: projectId })

    // Let invitees' UIs drop the now-dead invites.
    await this.emitResolved(pending, 'revoked')
  }

  async getProjectDetail(id: string, userId: string) {
    const { project, projectId } = await this.requireProject(id)
    const myRole = await this.requireRole(project, userId, 'any')

    const [members, rows, inviteDocs] = await Promise.all([
      ProjectMember.find({ projectId }).sort({ createdAt: 1 }),
      loadFileRows({ projectId }),
      myRole === 'owner'
        ? ProjectInvite.find({
            projectId,
            status: 'pending',
            expiresAt: { $gt: new Date() },
          }).sort({ createdAt: -1 })
        : Promise.resolve([] as IProjectInvite[]),
    ])

    const inviterIds = [
      ...new Set(inviteDocs.map((i) => i.invitedByUserId).filter(Boolean)),
    ]
    const [profiles, [dto], labelMap] = await Promise.all([
      resolveProfiles([...members.map((m) => m.userId), ...inviterIds]),
      this.buildProjectDTOs(
        [project],
        userId,
        new Map([[String(projectId), myRole]])
      ),
      labelsForRows(rows),
    ])

    return {
      project: dto as ProjectDTO,
      files: rows.map((row) =>
        toRemoteFile(row, myRole, labelMap.get(row.slug) ?? [])
      ),
      members: members.map<ProjectMemberDTO>((m) => {
        const profile = profiles.get(m.userId)
        return {
          userId: m.userId,
          name: profile?.name ?? 'Unknown',
          email: profile?.email ?? '',
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
          ...(m.userId === userId ? { isYou: true } : {}),
          ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
        }
      }),
      pendingInvites: inviteDocs.map((invite) =>
        serializeInvite(
          invite,
          project.name,
          profiles.get(invite.invitedByUserId)?.imageUrl
        )
      ),
      myRole,
    }
  }

  /* -------------------------------- invites ------------------------------- */

  async createInvite(
    id: string,
    userId: string,
    input: { email: string; role: InviteRole }
  ): Promise<{ invite: ProjectInviteDTO; emailSent: boolean }> {
    const { project, projectId } = await this.requireProject(id)
    await this.requireRole(project, userId, ['owner'])

    const email = normalizeEmail(input.email)
    const [inviterEmails, inviteeIds, profiles] = await Promise.all([
      getUserEmails(userId),
      findUserIdsByEmails([email]),
      resolveProfiles([userId]),
    ])

    const inviteeId = inviteeIds.get(email)
    const alreadyMember =
      inviterEmails.includes(email) ||
      (inviteeId
        ? Boolean(await ProjectMember.exists({ projectId, userId: inviteeId }))
        : false)
    if (alreadyMember) {
      throw new HttpError(
        409,
        'That person is already a member of this project'
      )
    }

    const inviterName = profiles.get(userId)?.name ?? 'Someone'
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

    // Refresh an existing pending invite (keeps the emailed link valid).
    let invite = await ProjectInvite.findOne({
      projectId,
      email,
      status: 'pending',
    })
    if (invite) {
      invite.role = input.role
      invite.expiresAt = expiresAt
      invite.invitedByUserId = userId
      invite.invitedByName = inviterName
    } else {
      invite = new ProjectInvite({
        projectId,
        email,
        role: input.role,
        token: newInviteToken(),
        invitedByUserId: userId,
        invitedByName: inviterName,
        status: 'pending',
        expiresAt,
      })
    }
    await invite.save()

    let emailSent = false
    try {
      const sent = await sendProjectInviteEmail({
        recipientEmail: email,
        projectName: project.name,
        inviterName,
        role: input.role,
        acceptUrl: `${getSiteUrl()}/workspace/invite?token=${encodeURIComponent(invite.token)}`,
      })
      emailSent = sent !== null
    } catch (error) {
      logger.error('[projects] Failed to send invite email', error)
    }

    const inviterImage = profiles.get(userId)?.imageUrl
    const dto = serializeInvite(invite, project.name, inviterImage)
    if (inviteeId) emitToUser(inviteeId, 'project-invite', dto)

    return { invite: dto, emailSent }
  }

  async revokeInvite(id: string, userId: string, token: string): Promise<void> {
    const { project, projectId } = await this.requireProject(id)
    await this.requireRole(project, userId, ['owner'])

    const invite = await ProjectInvite.findOne({
      projectId,
      token,
      status: 'pending',
    })
    if (!invite) throw new HttpError(404, 'Invite not found')

    invite.status = 'revoked'
    await invite.save()
    await this.emitResolved([invite], 'revoked')
  }

  async listPendingInvites(userId: string): Promise<ProjectInviteDTO[]> {
    const emails = await getUserEmails(userId)
    if (emails.length === 0) return []

    const invites = await ProjectInvite.find({
      email: { $in: emails },
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 })
    if (invites.length === 0) return []

    const projects = await Project.find({
      _id: { $in: invites.map((i) => i.projectId) },
    })
    const names = new Map(projects.map((p) => [String(p._id), p.name]))

    const inviterProfiles = await resolveProfiles(
      invites.map((i) => i.invitedByUserId).filter(Boolean)
    )

    return invites
      .filter((i) => names.has(String(i.projectId)))
      .map((i) =>
        serializeInvite(
          i,
          names.get(String(i.projectId)) as string,
          inviterProfiles.get(i.invitedByUserId)?.imageUrl
        )
      )
  }

  /** Load an invite and verify it belongs to the caller's email. */
  private async loadInviteForUser(
    token: string,
    userId: string
  ): Promise<IProjectInvite> {
    const invite = await ProjectInvite.findOne({ token })
    if (!invite) throw new HttpError(404, 'Invite not found')

    const emails = await getUserEmails(userId)
    if (!emails.includes(invite.email)) {
      throw new HttpError(
        403,
        'This invitation was sent to a different email address'
      )
    }
    return invite
  }

  private assertInviteActionable(invite: IProjectInvite): void {
    if (invite.status === 'revoked') {
      throw new HttpError(410, 'This invitation was revoked')
    }
    if (invite.status !== 'pending') {
      throw new HttpError(409, `This invitation was already ${invite.status}`)
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new HttpError(410, 'This invitation has expired')
    }
  }

  async getInvitePreview(
    token: string,
    userId: string
  ): Promise<ProjectInviteDTO> {
    const invite = await this.loadInviteForUser(token, userId)
    const project = await Project.findById(invite.projectId)
    if (!project) throw new HttpError(404, 'Project no longer exists')
    const profiles = await resolveProfiles([invite.invitedByUserId])
    return serializeInvite(
      invite,
      project.name,
      profiles.get(invite.invitedByUserId)?.imageUrl
    )
  }

  async acceptInvite(
    token: string,
    userId: string
  ): Promise<{ projectId: string }> {
    const invite = await this.loadInviteForUser(token, userId)
    const project = await Project.findById(invite.projectId)
    if (!project) throw new HttpError(404, 'Project no longer exists')

    const projectId = invite.projectId
    const projectIdStr = String(projectId)

    // Idempotent: already accepted and still a member.
    if (
      invite.status === 'accepted' &&
      (await ProjectMember.exists({ projectId, userId }))
    ) {
      return { projectId: projectIdStr }
    }

    this.assertInviteActionable(invite)

    // Explicit create so membership is never skipped by a no-op upsert.
    const existing = await ProjectMember.findOne({ projectId, userId })
    if (!existing) {
      try {
        await ProjectMember.create({
          projectId,
          userId,
          role: invite.role,
        })
      } catch (error) {
        // Race: another accept created the row — treat as success.
        const dup =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code?: number }).code === 11000
        if (!dup) throw error
      }
    }

    invite.status = 'accepted'
    await invite.save()

    // Bump so the project sorts to the top of the invitee's library.
    project.updatedAt = new Date()
    await project.save()

    // Keep local User email in sync for future invite matching.
    try {
      const emails = await getUserEmails(userId)
      const primary = emails[0]
      if (primary) {
        await User.updateOne(
          { clerkId: userId },
          {
            $set: { email: primary },
            $setOnInsert: { clerkId: userId },
          },
          { upsert: true }
        )
      }
    } catch (error) {
      logger.warn('[projects] Failed to sync user email after accept', error)
    }

    await this.emitResolved([invite], 'accepted', userId)
    return { projectId: projectIdStr }
  }

  async declineInvite(token: string, userId: string): Promise<void> {
    const invite = await this.loadInviteForUser(token, userId)
    this.assertInviteActionable(invite)
    invite.status = 'declined'
    await invite.save()
    await this.emitResolved([invite], 'declined', userId)
  }

  /**
   * Notify the invitee (drop toast) and project members / inviter (live people
   * panel + pending counts) that an invite is no longer pending.
   */
  private async emitResolved(
    invites: IProjectInvite[],
    status: 'accepted' | 'declined' | 'revoked',
    knownUserId?: string
  ): Promise<void> {
    if (invites.length === 0) return
    try {
      const inviteeIds = knownUserId
        ? new Map(invites.map((i) => [i.email, knownUserId]))
        : await findUserIdsByEmails(invites.map((i) => i.email))

      for (const invite of invites) {
        const projectId = String(invite.projectId)
        const payload = {
          token: invite.token,
          projectId,
          status,
          email: invite.email,
          role: invite.role,
        }

        const targets = new Set<string>()
        const invitee = inviteeIds.get(invite.email)
        if (invitee) targets.add(invitee)
        if (invite.invitedByUserId) targets.add(invite.invitedByUserId)

        const members = await ProjectMember.find({
          projectId: invite.projectId,
        })
          .select('userId')
          .lean()
        for (const m of members) targets.add(m.userId)

        for (const target of targets) {
          emitToUser(target, 'project-invite-resolved', payload)
        }
      }
    } catch (error) {
      logger.warn('[projects] Failed to emit invite-resolved', error)
    }
  }

  /* -------------------------------- members ------------------------------- */

  /** Keep Project.ownerId pointing at a current owner member. */
  private async syncProjectOwner(project: IProject): Promise<void> {
    const owners = await ProjectMember.find({
      projectId: project._id,
      role: 'owner',
    }).sort({ createdAt: 1 })
    const first = owners[0]
    if (first && !owners.some((o) => o.userId === project.ownerId)) {
      project.ownerId = first.userId
      await project.save()
    }
  }

  async updateMemberRole(
    id: string,
    actorId: string,
    targetUserId: string,
    role: Role
  ): Promise<void> {
    const { project, projectId } = await this.requireProject(id)
    await this.requireRole(project, actorId, ['owner'])

    const member = await ProjectMember.findOne({
      projectId,
      userId: targetUserId,
    })
    if (!member) throw new HttpError(404, 'Member not found')

    if (member.role === 'owner' && role !== 'owner') {
      const owners = await ProjectMember.countDocuments({
        projectId,
        role: 'owner',
      })
      if (owners <= 1) {
        throw new HttpError(409, 'A project must have at least one owner')
      }
    }

    member.role = role
    await member.save()
    await this.syncProjectOwner(project)
  }

  async removeMember(
    id: string,
    actorId: string,
    targetUserId: string
  ): Promise<void> {
    const { project, projectId } = await this.requireProject(id)
    const actorRole = await this.requireRole(project, actorId, 'any')
    const isSelf = actorId === targetUserId

    if (!isSelf && actorRole !== 'owner') {
      throw new HttpError(403, 'Only project owners can remove members')
    }

    const member = await ProjectMember.findOne({
      projectId,
      userId: targetUserId,
    })
    if (!member) throw new HttpError(404, 'Member not found')

    if (member.role === 'owner') {
      const owners = await ProjectMember.countDocuments({
        projectId,
        role: 'owner',
      })
      if (owners <= 1) {
        throw new HttpError(
          409,
          isSelf
            ? 'You are the last owner. Transfer ownership or delete the project instead.'
            : 'A project must have at least one owner'
        )
      }
    }

    await ProjectMember.deleteOne({ _id: member._id })
    await this.syncProjectOwner(project)
  }
}
