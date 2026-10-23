import { ShareService } from './share.service'
import { UserService } from './user.service'
import { HttpError, ProjectService } from './project.service'
import { labelService, type FileLabelDTO } from './label.service'
import ShareLink, {
  IShareLink,
  JsonShareMode,
  ShareAccessType,
  ShareType,
} from '../models/share.model'
import Project from '../models/project.model'
import { AccessTypeEnum, ModeEnum, ShareTypeEnum } from '../enums/enum'
import {
  contentKeyFromFragment,
  decryptContent,
  deriveKeyFromPassword,
  encryptContent,
  generateContentKey,
  generateSalt,
  unwrapContentKey,
  wrapContentKey,
} from '../mcp/crypto'
import { buildShareUrl } from '../mcp/urls'

const MAX_CONTENT_CHARS = 1_500_000
const TITLE_MAX = 60

const DEFAULT_TITLE: Record<ShareType, string> = {
  json: 'Untitled JSON',
  text: 'Untitled Text',
  markdown: 'Untitled Markdown',
  html: 'Untitled HTML',
}

export class McpShareError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'McpShareError'
  }
}

function fromHttp(error: unknown): never {
  if (error instanceof HttpError) throw new McpShareError(error.message)
  throw error
}

export interface CreateMcpShareInput {
  content: string
  type: ShareType
  mode?: JsonShareMode
  access?: ShareAccessType
  previewOnly?: boolean
  password?: string
  /** Library display title (max 60). Defaults by type when omitted. */
  title?: string
  /** Attach the new file to this project (must be a member with editor+). */
  projectId?: string
  /**
   * Label names or ids from list_labels (personal catalog, or the project
   * catalog when project_id is set). Multiple allowed.
   */
  labels?: string[]
}

export interface UpdateMcpShareInput {
  slug: string
  /** New body. Omit to only change title / project. */
  content?: string
  password?: string
  key?: string
  title?: string
  /** Move into a project, or `null` to make standalone. */
  projectId?: string | null
}

export interface ChangeMcpShareAccessInput {
  slug: string
  access: ShareAccessType
  key?: string
}

export interface ReadMcpShareInput {
  slug: string
  password?: string
  key?: string
}

const shareService = new ShareService()
const userService = new UserService()
const projectService = new ProjectService()

function normalizeTitle(title: string | undefined, type: ShareType): string {
  const trimmed = title?.trim().slice(0, TITLE_MAX)
  return trimmed || DEFAULT_TITLE[type]
}

function assertContent(content: string, type: ShareType): string {
  if (content.length > MAX_CONTENT_CHARS) {
    throw new McpShareError(
      `Content is too large. Keep it under ${MAX_CONTENT_CHARS.toLocaleString()} characters.`
    )
  }
  if (type === ShareTypeEnum.JSON) {
    try {
      JSON.parse(content)
    } catch {
      throw new McpShareError(
        'Content is not valid JSON. Fix the JSON, or set type to text, markdown, or html.'
      )
    }
  }
  return content
}

function isLegacy(record: IShareLink): boolean {
  return (
    !record.schemaVersion ||
    record.schemaVersion === 1 ||
    (Boolean(record.json) && !record.ciphertext)
  )
}

function formatLabelNames(labels?: FileLabelDTO[] | null): string {
  if (!labels?.length) return '(none)'
  return labels.map((l) => l.name).join(', ')
}

function shareSummary(
  record: IShareLink,
  url: string,
  extra?: {
    password?: string
    projectName?: string | null
    labels?: FileLabelDTO[] | null
  }
): string {
  const title = record.title?.trim() || DEFAULT_TITLE[record.type]
  const lines = [
    'File ready.',
    '',
    `URL: ${url}`,
    `Title: ${title}`,
    `Type: ${record.type}`,
    `Access: ${record.accessType}`,
    `Privacy: ${record.isPrivate ? 'private' : 'public'}`,
    `Slug: ${record.slug}`,
    `Labels: ${formatLabelNames(extra?.labels)}`,
  ]
  if (record.projectId) {
    lines.push(
      `Project: ${extra?.projectName || String(record.projectId)} (${String(record.projectId)})`
    )
  } else {
    lines.push('Project: (standalone — not in a project)')
  }
  if (record.type === ShareTypeEnum.JSON) {
    lines.push(`View: ${record.mode}`)
  }
  if (record.type === ShareTypeEnum.MARKDOWN && record.previewOnly) {
    lines.push('Markdown: preview only for people who are not the owner')
  }
  if (record.isPrivate) {
    lines.push(
      '',
      'Recipients need this link and the password. The password is not stored.',
      `Password: ${extra?.password || '(unchanged — use the password set when the link was created)'}`
    )
  } else {
    lines.push(
      '',
      'Share the full URL, including the #key= fragment. Without it the page cannot decrypt the document.'
    )
  }
  lines.push('', 'Links expire 30 days after they are created.')
  return lines.join('\n')
}

async function projectNameFor(projectId: unknown): Promise<string | null> {
  if (!projectId) return null
  const project = await Project.findById(projectId).select('name').lean()
  return project?.name ?? null
}

/** Resolve label names or ObjectId strings against the personal/project catalog. */
async function resolveLabelRefs(
  userId: string,
  projectId: string | null | undefined,
  refs: string[]
): Promise<string[]> {
  let catalog: FileLabelDTO[]
  try {
    catalog = await labelService.listForUser(userId, projectId ?? null)
  } catch (error) {
    fromHttp(error)
  }
  const byId = new Map(catalog.map((l) => [l.id, l]))
  const byName = new Map(catalog.map((l) => [l.name.toLowerCase(), l]))
  const ids: string[] = []
  for (const raw of refs) {
    const ref = raw.trim()
    if (!ref) continue
    const found = byId.get(ref) || byName.get(ref.toLowerCase())
    if (!found) {
      throw new McpShareError(
        `Unknown label "${ref}". Call list_labels${projectId ? ' with this project_id' : ''} first (defaults: docs, feature, bug, general).`
      )
    }
    if (!ids.includes(found.id)) ids.push(found.id)
  }
  return ids
}

async function labelsForSlug(slug: string): Promise<FileLabelDTO[]> {
  const share = await ShareLink.findOne({ slug }).select('labelIds').lean()
  if (!share?.labelIds?.length) return []
  const map = await labelService.hydrateLabels([share.labelIds])
  return (share.labelIds as unknown[])
    .map((id) => map.get(String(id)))
    .filter((l): l is FileLabelDTO => Boolean(l))
}

async function wrapForOwner(
  userId: string,
  contentKey: Buffer
): Promise<string> {
  const secret = await userService.getOrCreateKeyWrapSecret(userId)
  return wrapContentKey(contentKey, secret)
}

async function keyFromStoredWrap(
  record: IShareLink,
  userId: string
): Promise<Buffer | null> {
  if (!record.contentKeyWrapped || record.ownerId !== userId) return null
  const secret = await userService.getOrCreateKeyWrapSecret(userId)
  return unwrapContentKey(record.contentKeyWrapped, secret)
}

async function resolveContentKey(
  record: IShareLink,
  userId: string,
  input: { key?: string; password?: string }
): Promise<Buffer> {
  if (input.key) {
    try {
      return contentKeyFromFragment(input.key)
    } catch {
      throw new McpShareError(
        'The #key= fragment is not a valid document key. Pass the full share URL.'
      )
    }
  }

  if (input.password) {
    if (!record.salt) {
      throw new McpShareError(
        'This document is not password-protected. Pass the full share URL, including #key=.'
      )
    }
    return deriveKeyFromPassword(input.password, record.salt)
  }

  const stored = await keyFromStoredWrap(record, userId)
  if (stored) return stored

  if (record.isPrivate) {
    throw new McpShareError('This document is private. Pass its password.')
  }
  throw new McpShareError(
    'This public link is missing its #key= fragment. Pass the full share URL.'
  )
}

export class McpShareService {
  async createShare(
    userId: string,
    input: CreateMcpShareInput
  ): Promise<string> {
    const type = input.type
    const content = assertContent(input.content, type)
    const title = normalizeTitle(input.title, type)
    const mode =
      type === ShareTypeEnum.JSON
        ? input.mode || ModeEnum.FORMATTER
        : ModeEnum.FORMATTER
    // Link access is view-only; the MCP token owner edits via ownership.
    const access = input.access || AccessTypeEnum.VIEWER
    const previewOnly =
      type === ShareTypeEnum.MARKDOWN && input.previewOnly === true
    const password = input.password?.trim()
    if (input.password !== undefined && (!password || password.length < 4)) {
      throw new McpShareError('Password must be at least 4 characters.')
    }
    const isPrivate = Boolean(password)

    let key: Buffer
    let keyString: string | undefined
    let salt: string | undefined
    if (isPrivate && password) {
      salt = generateSalt()
      key = deriveKeyFromPassword(password, salt)
    } else {
      const generated = generateContentKey()
      key = generated.key
      keyString = generated.keyString
    }

    const encrypted = encryptContent(content, key)
    const wrapped = await wrapForOwner(userId, key)

    let record = await shareService.createShareLink({
      ownerId: userId,
      schemaVersion: 2,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      salt,
      ownerKeyWrapped: isPrivate ? wrapped : undefined,
      contentKeyWrapped: wrapped,
      mode,
      isPrivate,
      accessType: access,
      previewOnly,
      type,
      title,
    })

    let projectName: string | null = null
    if (input.projectId) {
      try {
        const file = await projectService.patchShare(record.slug, userId, {
          title,
          projectId: input.projectId,
        })
        projectName = await projectNameFor(file.projectId)
        record = (await shareService.getShareLink(record.slug)) || record
      } catch (error) {
        fromHttp(error)
      }
    }

    let labels: FileLabelDTO[] = []
    if (input.labels?.length) {
      const projectScope = record.projectId ? String(record.projectId) : null
      const labelIds = await resolveLabelRefs(
        userId,
        projectScope,
        input.labels
      )
      try {
        const result = await labelService.setFileLabels(
          userId,
          record.slug,
          labelIds
        )
        labels = result.labels
      } catch (error) {
        fromHttp(error)
      }
    }

    const url = buildShareUrl({
      type: record.type,
      slug: record.slug,
      mode: record.mode,
      keyString: isPrivate ? undefined : keyString,
    })
    return shareSummary(record, url, {
      password: password || undefined,
      projectName,
      labels,
    })
  }

  async updateShare(
    userId: string,
    input: UpdateMcpShareInput
  ): Promise<string> {
    let existing: IShareLink
    try {
      existing = await projectService.requireShareWrite(input.slug, userId)
    } catch (error) {
      fromHttp(error)
    }

    const hasContent = input.content !== undefined
    const hasTitle = input.title !== undefined
    const hasProject = input.projectId !== undefined
    if (!hasContent && !hasTitle && !hasProject) {
      throw new McpShareError(
        'Pass content, title, and/or project_id to update.'
      )
    }

    const type = existing.type
    const mode = existing.mode
    const access = existing.accessType
    const previewOnly = existing.previewOnly === true

    let updated = existing
    let keyString: string | undefined

    if (hasContent) {
      const content = assertContent(input.content as string, type)
      let key: Buffer
      let salt = existing.salt
      if (isLegacy(existing)) {
        if (existing.isPrivate) {
          if (!input.password) {
            throw new McpShareError(
              'This private document needs its password before it can be updated.'
            )
          }
          salt = existing.salt || generateSalt()
          key = deriveKeyFromPassword(input.password, salt)
        } else if (input.key) {
          try {
            key = contentKeyFromFragment(input.key)
          } catch {
            throw new McpShareError(
              'The #key= fragment is not a valid document key. Pass the full share URL.'
            )
          }
        } else {
          key = generateContentKey().key
        }
      } else {
        key = await resolveContentKey(existing, userId, {
          key: input.key,
          password: input.password,
        })
      }

      const encrypted = encryptContent(content, key)
      // Re-wrap for the document owner so their library can keep decrypting.
      const wrapOwnerId = existing.ownerId || userId
      const wrapped = await wrapForOwner(wrapOwnerId, key)
      keyString = existing.isPrivate ? undefined : key.toString('base64url')

      const next = await shareService.updateShareLink(existing.slug, {
        ownerId: wrapOwnerId,
        schemaVersion: 2,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: existing.isPrivate ? salt : undefined,
        ownerKeyWrapped: existing.isPrivate ? wrapped : null,
        contentKeyWrapped: wrapped,
        mode,
        isPrivate: existing.isPrivate,
        accessType: access,
        previewOnly,
        type,
        ...(hasTitle ? { title: normalizeTitle(input.title, type) } : {}),
      })
      if (!next) throw new McpShareError('Document not found.')
      updated = next
    }

    if (hasTitle || hasProject) {
      try {
        const file = await projectService.patchShare(existing.slug, userId, {
          ...(hasTitle ? { title: normalizeTitle(input.title, type) } : {}),
          ...(hasProject ? { projectId: input.projectId ?? null } : {}),
        })
        updated = (await shareService.getShareLink(existing.slug)) || updated
        if (!keyString && !updated.isPrivate) {
          const stored = await keyFromStoredWrap(updated, userId)
          keyString = stored?.toString('base64url')
        }
        const url = buildShareUrl({
          type: updated.type,
          slug: updated.slug,
          mode: updated.mode,
          keyString,
        })
        return shareSummary(updated, url, {
          password: input.password,
          projectName: await projectNameFor(file.projectId),
        })
      } catch (error) {
        fromHttp(error)
      }
    }

    if (!keyString && !updated.isPrivate) {
      const stored = await keyFromStoredWrap(updated, userId)
      keyString = stored?.toString('base64url')
    }

    const url = buildShareUrl({
      type: updated.type,
      slug: updated.slug,
      mode: updated.mode,
      keyString,
    })
    return shareSummary(updated, url, {
      password: input.password,
      projectName: await projectNameFor(updated.projectId),
    })
  }

  async listProjects(userId: string): Promise<string> {
    const projects = await projectService.listProjects(userId)
    if (projects.length === 0) {
      return 'No projects yet. Use create_project, then create_file with project_id to add files.'
    }
    const lines = [
      `${projects.length} project${projects.length === 1 ? '' : 's'}:`,
      '',
    ]
    for (const p of projects) {
      const pending =
        p.pendingInviteCount && p.pendingInviteCount > 0
          ? ` · ${p.pendingInviteCount} pending invite${p.pendingInviteCount === 1 ? '' : 's'}`
          : ''
      lines.push(
        `- ${p.name}`,
        `  id: ${p.id}`,
        `  role: ${p.myRole ?? 'member'} · ${p.fileCount ?? 0} files · ${p.memberCount ?? 0} members${pending}`
      )
    }
    lines.push(
      '',
      'Use get_project with an id to list that project’s files, or create_file with project_id to add one.'
    )
    return lines.join('\n')
  }

  async createProject(userId: string, name: string): Promise<string> {
    const trimmed = name.trim()
    if (!trimmed) throw new McpShareError('Project name is required.')
    if (trimmed.length > 80) {
      throw new McpShareError('Project name must be 80 characters or fewer.')
    }
    try {
      const project = await projectService.createProject(userId, trimmed)
      return [
        'Project created.',
        '',
        `Name: ${project.name}`,
        `id: ${project.id}`,
        '',
        'Add a file with create_file and pass this id as project_id.',
      ].join('\n')
    } catch (error) {
      fromHttp(error)
    }
  }

  /** One project’s metadata + file list (no decrypted bodies). */
  async getProject(
    userId: string,
    projectId: string,
    opts?: { labelRefs?: string[] }
  ): Promise<string> {
    try {
      const detail = await projectService.getProjectDetail(projectId, userId)
      const { project, files, myRole } = detail
      let filtered = files
      if (opts?.labelRefs?.length) {
        const want = new Set(
          await resolveLabelRefs(userId, projectId, opts.labelRefs)
        )
        filtered = files.filter((f) =>
          (f.labels ?? []).some((l) => want.has(l.id))
        )
      }
      const lines = [
        `Project: ${project.name}`,
        `id: ${project.id}`,
        `Your role: ${myRole}`,
        `Files: ${filtered.length}${opts?.labelRefs?.length ? ` (filtered by label; ${files.length} total)` : ''}`,
        '',
      ]
      if (filtered.length === 0) {
        lines.push(
          files.length === 0
            ? 'No files yet. Use create_file with this project_id to add one.'
            : 'No files match the selected labels.'
        )
        return lines.join('\n')
      }
      for (const file of filtered) {
        lines.push(
          `- ${file.title?.trim() || DEFAULT_TITLE[file.type]}`,
          `  slug: ${file.slug} · ${file.type} · ${file.role} · ${file.shareMode}`,
          `  labels: ${formatLabelNames(file.labels)}`
        )
      }
      lines.push(
        '',
        'Use read_file / write_file with a slug (or full URL) to open or edit content.',
        'Use set_file_labels to assign labels; list_labels to see the project catalog.'
      )
      return lines.join('\n')
    } catch (error) {
      fromHttp(error)
    }
  }

  /**
   * List library files. Pass projectId to scope to one project; omit for the
   * whole library (standalone + all projects). Optional labels filter (names or ids).
   */
  async listFiles(
    userId: string,
    opts?: {
      projectId?: string
      limit?: number
      labelRefs?: string[]
    }
  ): Promise<string> {
    const limit = opts?.limit ?? 20
    if (opts?.projectId) {
      return this.getProject(userId, opts.projectId, {
        labelRefs: opts.labelRefs,
      })
    }
    return this.listShares(userId, limit, opts?.labelRefs)
  }

  async listLabels(userId: string, projectId?: string | null): Promise<string> {
    let labels: FileLabelDTO[]
    try {
      labels = await labelService.listForUser(userId, projectId ?? null)
    } catch (error) {
      fromHttp(error)
    }
    const scope = projectId
      ? `project ${projectId}`
      : 'personal library (standalone files)'
    const lines = [
      `Labels for ${scope} (${labels.length}):`,
      'Defaults: docs, feature, bug, general. Owners can create custom labels.',
      'Pass names or ids to create_file.labels / set_file_labels / list_files.labels.',
      '',
    ]
    for (const label of labels) {
      lines.push(
        `- ${label.name}${label.isDefault ? ' (default)' : ''}`,
        `  id: ${label.id} · color: ${label.color}`
      )
    }
    return lines.join('\n')
  }

  async createLabel(
    userId: string,
    input: { name: string; color?: string; projectId?: string | null }
  ): Promise<string> {
    let label: FileLabelDTO
    try {
      label = await labelService.create(userId, {
        name: input.name,
        color: input.color,
        projectId: input.projectId ?? null,
      })
    } catch (error) {
      fromHttp(error)
    }
    const scope = label.projectId
      ? `project ${label.projectId}`
      : 'personal library'
    return [
      'Label created.',
      '',
      `Name: ${label.name}`,
      `id: ${label.id}`,
      `Color: ${label.color}`,
      `Scope: ${scope}`,
      '',
      'Assign it with set_file_labels (or create_file.labels).',
    ].join('\n')
  }

  async setFileLabels(
    userId: string,
    input: { slug: string; labels: string[] }
  ): Promise<string> {
    const share = await shareService.getShareLink(input.slug)
    if (!share) throw new McpShareError('Document not found.')
    const projectScope = share.projectId ? String(share.projectId) : null
    const labelIds = await resolveLabelRefs(userId, projectScope, input.labels)
    let result: { labels: FileLabelDTO[] }
    try {
      result = await labelService.setFileLabels(userId, input.slug, labelIds)
    } catch (error) {
      fromHttp(error)
    }
    const title = share.title?.trim() || DEFAULT_TITLE[share.type]
    return [
      'Labels updated.',
      '',
      `File: ${title}`,
      `Slug: ${input.slug}`,
      `Labels: ${formatLabelNames(result.labels)}`,
      '',
      'Pass an empty labels array to clear all labels on the file.',
    ].join('\n')
  }

  async changeShareAccess(
    userId: string,
    input: ChangeMcpShareAccessInput
  ): Promise<string> {
    const existing = await shareService.getShareLink(input.slug)
    if (!existing) throw new McpShareError('Document not found.')
    if (!existing.ownerId || existing.ownerId !== userId) {
      throw new McpShareError(
        'You can only change access for documents created with this account.'
      )
    }

    let keyString: string | undefined
    if (!existing.isPrivate) {
      if (input.key) {
        try {
          keyString = contentKeyFromFragment(input.key).toString('base64url')
        } catch {
          throw new McpShareError(
            'The #key= fragment is not a valid document key. Pass the full share URL.'
          )
        }
      } else {
        const storedKey = await keyFromStoredWrap(existing, userId)
        keyString = storedKey?.toString('base64url')
      }
    }

    const updated = await ShareLink.findOneAndUpdate(
      { slug: existing.slug, ownerId: userId },
      { $set: { accessType: input.access } },
      { new: true }
    )
    if (!updated) throw new McpShareError('Document not found.')

    const url = buildShareUrl({
      type: updated.type,
      slug: updated.slug,
      mode: updated.mode,
      keyString,
    })

    return [
      'Share access updated.',
      '',
      `URL: ${url}`,
      `Access: ${updated.accessType}`,
      `Slug: ${updated.slug}`,
      '',
      keyString
        ? 'Share the full URL, including the #key= fragment.'
        : updated.isPrivate
          ? 'Recipients still need the document password.'
          : 'Use the original full share URL because its encryption key is not stored in the URL above.',
    ].join('\n')
  }

  async readShare(userId: string, input: ReadMcpShareInput): Promise<string> {
    const record = await shareService.getShareLink(input.slug)
    if (!record) throw new McpShareError('Document not found.')

    if (isLegacy(record)) {
      if (record.isPrivate) {
        if (!input.password) {
          throw new McpShareError(
            'This document is private. Pass its password.'
          )
        }
        const valid = shareService.verifyLegacyPassword(record, input.password)
        if (!valid) throw new McpShareError('Password is incorrect.')
      }
      return [
        `Slug: ${record.slug}`,
        `Type: ${record.type}`,
        `Privacy: ${record.isPrivate ? 'private' : 'public'}`,
        '',
        record.json || '',
      ].join('\n')
    }

    const key = await resolveContentKey(record, userId, {
      key: input.key,
      password: input.password,
    })

    let content: string
    try {
      content = decryptContent(record.ciphertext || '', record.iv || '', key)
    } catch {
      throw new McpShareError(
        'Could not decrypt this document. Check the full share URL or password.'
      )
    }

    const url = buildShareUrl({
      type: record.type,
      slug: record.slug,
      mode: record.mode,
      keyString: record.isPrivate ? undefined : key.toString('base64url'),
    })

    const title = record.title?.trim() || DEFAULT_TITLE[record.type]
    const projectName = await projectNameFor(record.projectId)
    const labels = await labelsForSlug(record.slug)

    return [
      `URL: ${url}`,
      `Title: ${title}`,
      `Type: ${record.type}`,
      `Access: ${record.accessType}`,
      `Privacy: ${record.isPrivate ? 'private' : 'public'}`,
      projectName
        ? `Project: ${projectName} (${String(record.projectId)})`
        : 'Project: (standalone)',
      `Labels: ${formatLabelNames(labels)}`,
      '',
      content,
    ].join('\n')
  }

  async listShares(
    userId: string,
    limit: number,
    labelRefs?: string[]
  ): Promise<string> {
    let library: Awaited<ReturnType<ProjectService['listLibrary']>>
    try {
      library = await projectService.listLibrary(userId)
    } catch (error) {
      fromHttp(error)
    }

    type Listed = {
      slug: string
      title: string
      type: ShareType
      shareMode: string
      role: string
      updatedAt: string
      projectLabel: string
      projectId: string | null
      labels: FileLabelDTO[]
    }

    const allFiles: Listed[] = [
      ...library.standalone.map((f) => ({
        slug: f.slug,
        title: f.title,
        type: f.type,
        shareMode: f.shareMode,
        role: f.role,
        updatedAt: f.updatedAt,
        projectLabel: 'standalone',
        projectId: null as string | null,
        labels: f.labels ?? [],
      })),
      ...library.projects.flatMap(({ project, files }) =>
        files.map((f) => ({
          slug: f.slug,
          title: f.title,
          type: f.type,
          shareMode: f.shareMode,
          role: f.role,
          updatedAt: f.updatedAt,
          projectLabel: `project: ${project.name} (${project.id})`,
          projectId: project.id,
          labels: f.labels ?? [],
        }))
      ),
    ]

    const seen = new Set<string>()
    let files = allFiles
      .filter((f) => {
        if (seen.has(f.slug)) return false
        seen.add(f.slug)
        return true
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    if (labelRefs?.length) {
      const wantIds = new Set(
        labelRefs
          .map((r) => r.trim())
          .filter((r) => /^[a-fA-F0-9]{24}$/.test(r))
      )
      const wantNames = new Set(
        labelRefs.map((r) => r.trim().toLowerCase()).filter(Boolean)
      )
      files = files.filter((f) =>
        (f.labels ?? []).some(
          (l) => wantIds.has(l.id) || wantNames.has(l.name.toLowerCase())
        )
      )
    }

    files = files.slice(0, limit)

    if (files.length === 0) {
      return labelRefs?.length
        ? 'No documents match those labels.'
        : 'No documents yet. Use create_file to publish one, optionally with project_id and labels.'
    }

    const lines: string[] = [
      `${files.length} document${files.length === 1 ? '' : 's'} in your library (showing up to ${limit}).`,
      `${library.projects.length} project${library.projects.length === 1 ? '' : 's'} · ${library.standalone.length} standalone.`,
      'Links expire 30 days after creation.',
      '',
    ]

    for (const file of files) {
      const record = await shareService.getShareLink(file.slug)
      let url = buildShareUrl({
        type: file.type,
        slug: file.slug,
        mode: record?.mode || ModeEnum.FORMATTER,
      })
      let note = ''

      if (record && !record.isPrivate && record.contentKeyWrapped) {
        try {
          const key = await keyFromStoredWrap(record, userId)
          if (key) {
            url = buildShareUrl({
              type: file.type,
              slug: file.slug,
              mode: record.mode,
              keyString: key.toString('base64url'),
            })
          }
        } catch {
          note = ' (encryption key could not be restored)'
        }
      } else if (record && !record.isPrivate && !record.contentKeyWrapped) {
        note =
          ' (created in the browser; the #key= fragment is only in the original link)'
      } else if (record?.isPrivate) {
        note = ' (private — password required)'
      }

      const title = file.title?.trim() || DEFAULT_TITLE[file.type]
      lines.push(
        `- ${title}`,
        `  slug: ${file.slug} · ${file.type} · ${file.shareMode} · ${file.role} · ${file.projectLabel}${note}`,
        `  labels: ${formatLabelNames(file.labels)}`,
        `  ${url}`
      )
    }

    return lines.join('\n')
  }
}
