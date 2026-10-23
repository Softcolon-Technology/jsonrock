export type Role = 'owner' | 'editor' | 'viewer'

/** Roles that can be granted through an invite. */
export type InviteRole = Exclude<Role, 'owner'>

export type DocType = 'json' | 'text' | 'markdown' | 'html'

export type ShareMode = 'off' | 'link' | 'password'

export interface FileLabel {
  id: string
  name: string
  color: string
  isDefault?: boolean
  projectId?: string | null
}

export interface RemoteFile {
  slug: string
  title: string
  type: DocType
  updatedAt: string
  createdAt?: string
  /** Preferred size field from the API contract. */
  sizeBytes?: number
  /** Legacy alias used by early UI drafts. */
  size?: number
  /** `null` = standalone remote file. */
  projectId: string | null
  /** Signed-in user's effective role for this file. */
  role: Role
  hasLocalCopy?: boolean
  shareMode?: ShareMode
  /** Display name of the last editor (project files). */
  updatedByName?: string | null
  /** True when the last edit was made by the signed-in user. */
  updatedByMe?: boolean
  passwordProtected?: boolean
  /** Multi-assign labels from the personal or project catalog. */
  labels?: FileLabel[]
}

export interface ProjectMemberPreview {
  userId: string
  name: string
  imageUrl?: string
}

export interface Project {
  id: string
  name: string
  ownerId: string
  memberCount: number
  fileCount: number
  updatedAt: string
  createdAt?: string
  pendingInviteCount?: number
  /** Signed-in user's role in the project (API: `myRole`). */
  myRole: Role
  /**
   * Alias of `myRole` kept for UI that was written against early drafts.
   * Prefer `myRole` for new code.
   */
  role: Role
  /** First few members, used for the avatar stack on cards. */
  memberPreview?: ProjectMemberPreview[]
}

export interface ProjectMember {
  userId: string
  name: string
  email: string
  role: Role
  joinedAt?: string
  /** True for the signed-in user's own row. */
  isYou?: boolean
  imageUrl?: string
}

export type ProjectInviteStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'revoked'
  | 'expired'

export interface ProjectInvite {
  token: string
  projectId: string
  projectName: string
  email: string
  role: InviteRole
  invitedByName: string
  invitedByImageUrl?: string
  createdAt: string
  expiresAt: string
  /** Legacy / UI helpers */
  id?: string
  status?: ProjectInviteStatus
  invitedByEmail?: string
  noAccount?: boolean
  projectFileCount?: number
  projectMemberCount?: number
}

/** GET /api/files */
export interface FilesLibraryResponse {
  standalone: RemoteFile[]
  projects: Array<{ project: Project; files: RemoteFile[] }>
}

/** Normalized library hub data (projects list + standalone files). */
export interface LibraryData {
  standalone: RemoteFile[]
  projects: Project[]
}

/** GET /api/projects/:id */
export interface ProjectDetail {
  project: Project
  files: RemoteFile[]
  members: ProjectMember[]
  pendingInvites: ProjectInvite[]
  myRole: Role
  /** Alias of pendingInvites for early UI. */
  invites: ProjectInvite[]
}

/** Normalize project payloads that may use `myRole` or `role`. */
export function normalizeProject(
  raw: Partial<Project> & { id: string }
): Project {
  const role = (raw.myRole ?? raw.role ?? 'viewer') as Role
  return {
    id: raw.id,
    name: raw.name ?? 'Untitled project',
    ownerId: raw.ownerId ?? '',
    memberCount: raw.memberCount ?? 0,
    fileCount: raw.fileCount ?? 0,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    createdAt: raw.createdAt,
    pendingInviteCount: raw.pendingInviteCount,
    myRole: role,
    role,
    memberPreview: raw.memberPreview,
  }
}

export function normalizeInvite(
  raw: Partial<ProjectInvite> & { token?: string; id?: string }
): ProjectInvite | null {
  const token = raw.token ?? raw.id
  if (!token || !raw.projectId) return null
  return {
    token,
    id: raw.id ?? token,
    projectId: raw.projectId,
    projectName: raw.projectName ?? 'Project',
    email: raw.email ?? '',
    role: (raw.role ?? 'viewer') as InviteRole,
    invitedByName: raw.invitedByName ?? 'Someone',
    invitedByImageUrl: raw.invitedByImageUrl,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    expiresAt: raw.expiresAt ?? '',
    status: raw.status ?? 'pending',
    invitedByEmail: raw.invitedByEmail,
    noAccount: raw.noAccount,
    projectFileCount: raw.projectFileCount,
    projectMemberCount: raw.projectMemberCount,
  }
}
