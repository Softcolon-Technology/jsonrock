import { Types } from 'mongoose'
import ShareLink from '../models/share.model'
import ProjectMember from '../models/project-member.model'
import Project from '../models/project.model'
import FileLabel, {
  DEFAULT_FILE_LABELS,
  IFileLabel,
} from '../models/file-label.model'
import { HttpError } from '../lib/http-error'

export interface FileLabelDTO {
  id: string
  name: string
  color: string
  isDefault: boolean
  projectId?: string | null
}

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function toDto(doc: IFileLabel): FileLabelDTO {
  return {
    id: String(doc._id),
    name: doc.name,
    color: doc.color,
    isDefault: doc.isDefault === true,
    projectId: doc.projectId ? String(doc.projectId) : null,
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 40)
}

async function requireProjectMembership(
  projectId: string,
  userId: string
): Promise<void> {
  const project = await Project.findById(projectId).select('_id')
  if (!project) throw new HttpError(404, 'Project not found')
  const member = await ProjectMember.findOne({
    projectId: project._id,
    userId,
  }).select('role')
  if (!member) throw new HttpError(404, 'Project not found')
}

async function requireProjectOwner(
  projectId: string,
  userId: string
): Promise<void> {
  const project = await Project.findById(projectId).select('_id')
  if (!project) throw new HttpError(404, 'Project not found')
  const member = await ProjectMember.findOne({
    projectId: project._id,
    userId,
    role: 'owner',
  }).select('_id')
  if (!member) throw new HttpError(403, 'You do not have permission to do that')
}

async function requireShareWrite(slug: string, userId: string) {
  const share = await ShareLink.findOne({ slug })
  if (!share) throw new HttpError(404, 'File not found')

  if (share.ownerId && share.ownerId === userId) return share

  if (share.projectId) {
    const member = await ProjectMember.findOne({
      projectId: share.projectId,
      userId,
    }).select('role')
    if (member && (member.role === 'owner' || member.role === 'editor')) {
      return share
    }
    if (member) {
      throw new HttpError(403, 'You do not have permission to edit this file')
    }
  }
  throw new HttpError(404, 'File not found')
}

export class LabelService {
  /** Ensure default docs/feature/bug/general labels exist for the scope. */
  async ensureDefaults(scope: {
    ownerId?: string
    projectId?: string
  }): Promise<void> {
    if (!scope.projectId && !scope.ownerId) return

    const scopeFilter = scope.projectId
      ? { projectId: new Types.ObjectId(scope.projectId) }
      : { ownerId: scope.ownerId as string }

    // Migrate legacy seeded name → docs.
    const legacy = await FileLabel.findOne({
      ...scopeFilter,
      name: 'documentation',
    })
    if (legacy) {
      const docsExists = await FileLabel.exists({
        ...scopeFilter,
        name: { $regex: /^docs$/i },
      })
      if (docsExists) {
        await FileLabel.deleteOne({ _id: legacy._id })
      } else {
        legacy.name = 'docs'
        legacy.color = '#8b5cf6'
        legacy.isDefault = true
        try {
          await legacy.save()
        } catch (error) {
          if (!isDuplicateKey(error)) throw error
          await FileLabel.deleteOne({ _id: legacy._id })
        }
      }
    }

    for (const d of DEFAULT_FILE_LABELS) {
      try {
        await FileLabel.updateOne(
          { ...scopeFilter, name: d.name },
          {
            $setOnInsert: {
              name: d.name,
              color: d.color,
              isDefault: true,
              ...scopeFilter,
            },
          },
          { upsert: true }
        )
      } catch (error) {
        // Race on unique index — another request inserted the same label.
        if (!isDuplicateKey(error)) {
          console.error('Failed to seed default label', d.name, error)
        }
      }
    }
  }

  async listForUser(
    userId: string,
    projectId?: string | null
  ): Promise<FileLabelDTO[]> {
    if (projectId) {
      await requireProjectMembership(projectId, userId)
      try {
        await this.ensureDefaults({ projectId })
      } catch (e) {
        console.error('ensureDefaults(project) failed', e)
      }
      const pid = new Types.ObjectId(projectId)
      const catalog = await FileLabel.find({ projectId: pid }).sort({
        name: 1,
      })
      const projectFiles = await ShareLink.find({ projectId: pid })
        .select('labelIds')
        .lean()
      const orphanIds = new Set<string>()
      for (const row of projectFiles) {
        for (const id of row.labelIds ?? []) orphanIds.add(String(id))
      }
      const known = new Set(catalog.map((d) => String(d._id)))
      const missing = toObjectIds([...orphanIds].filter((id) => !known.has(id)))
      const extras =
        missing.length > 0
          ? await FileLabel.find({ _id: { $in: missing } })
          : []
      const merged = dedupeLabels([...catalog, ...extras])
      return merged.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }

    try {
      await this.ensureDefaults({ ownerId: userId })
    } catch (e) {
      console.error('ensureDefaults(personal) failed', e)
    }

    const catalog = await FileLabel.find({ ownerId: userId }).sort({ name: 1 })

    // Also surface labels already on standalone files (orphan / legacy rows).
    const standalone = await ShareLink.find({
      ownerId: userId,
      $or: [{ projectId: null }, { projectId: { $exists: false } }],
    })
      .select('labelIds')
      .lean()
    const orphanIds = new Set<string>()
    for (const row of standalone) {
      for (const id of row.labelIds ?? []) orphanIds.add(String(id))
    }
    const known = new Set(catalog.map((d) => String(d._id)))
    const missing = toObjectIds([...orphanIds].filter((id) => !known.has(id)))
    const extras =
      missing.length > 0 ? await FileLabel.find({ _id: { $in: missing } }) : []

    const merged = dedupeLabels([...catalog, ...extras])
    return merged.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  async create(
    userId: string,
    input: { name: string; color?: string; projectId?: string | null }
  ): Promise<FileLabelDTO> {
    const name = normalizeName(input.name)
    if (!name) throw new HttpError(400, 'Label name is required')

    const color =
      input.color && COLOR_RE.test(input.color) ? input.color : '#64748b'

    if (input.projectId) {
      await requireProjectOwner(input.projectId, userId)
      await this.ensureDefaults({ projectId: input.projectId })
      try {
        const doc = await FileLabel.create({
          name,
          color,
          isDefault: false,
          projectId: new Types.ObjectId(input.projectId),
        })
        return toDto(doc)
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new HttpError(409, 'A label with that name already exists')
        }
        throw error
      }
    }

    await this.ensureDefaults({ ownerId: userId })
    try {
      const doc = await FileLabel.create({
        name,
        color,
        isDefault: false,
        ownerId: userId,
      })
      return toDto(doc)
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new HttpError(409, 'A label with that name already exists')
      }
      throw error
    }
  }

  async remove(userId: string, labelId: string): Promise<void> {
    const label = await FileLabel.findById(labelId)
    if (!label) throw new HttpError(404, 'Label not found')
    if (label.isDefault) {
      throw new HttpError(400, 'Default labels cannot be deleted')
    }

    if (label.projectId) {
      await requireProjectOwner(String(label.projectId), userId)
    } else if (label.ownerId !== userId) {
      throw new HttpError(404, 'Label not found')
    }

    await FileLabel.deleteOne({ _id: label._id })
    await ShareLink.updateMany(
      { labelIds: label._id },
      { $pull: { labelIds: label._id } }
    )
  }

  /**
   * Replace the set of labels on a file. Labels must belong to the file’s
   * scope (project catalog or personal catalog).
   */
  async setFileLabels(
    userId: string,
    slug: string,
    labelIds: string[]
  ): Promise<{ slug: string; labelIds: string[]; labels: FileLabelDTO[] }> {
    const share = await requireShareWrite(slug, userId)

    const uniqueIds = [
      ...new Set(
        labelIds.filter((id) => Types.ObjectId.isValid(id) && id.length === 24)
      ),
    ]
    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id))

    let allowed: IFileLabel[] = []
    if (objectIds.length > 0) {
      if (share.projectId) {
        allowed = await FileLabel.find({
          _id: { $in: objectIds },
          projectId: share.projectId,
        })
      } else {
        allowed = await FileLabel.find({
          _id: { $in: objectIds },
          ownerId: userId,
        })
      }
      if (allowed.length !== objectIds.length) {
        throw new HttpError(400, 'One or more labels are invalid for this file')
      }
    }

    share.labelIds = allowed.map((l) => l._id as Types.ObjectId)
    await share.save()

    const labels = allowed.map(toDto)
    return {
      slug,
      labelIds: labels.map((l) => l.id),
      labels,
    }
  }

  /** Hydrate label DTOs for a batch of files (by label id lists). */
  async hydrateLabels(
    labelIdLists: Array<Types.ObjectId[] | undefined>
  ): Promise<Map<string, FileLabelDTO>> {
    const ids = new Set<string>()
    for (const list of labelIdLists) {
      for (const id of list ?? []) ids.add(String(id))
    }
    if (ids.size === 0) return new Map()

    const docs = await FileLabel.find({
      _id: {
        $in: [...ids].map((id) => new Types.ObjectId(id)),
      },
    })
    const map = new Map<string, FileLabelDTO>()
    for (const doc of docs) map.set(String(doc._id), toDto(doc))
    return map
  }
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  )
}

function toObjectIds(ids: Iterable<string>): Types.ObjectId[] {
  const out: Types.ObjectId[] = []
  for (const id of ids) {
    if (Types.ObjectId.isValid(id) && String(id).length === 24) {
      out.push(new Types.ObjectId(id))
    }
  }
  return out
}

function dedupeLabels(docs: IFileLabel[]): FileLabelDTO[] {
  const seen = new Set<string>()
  const out: FileLabelDTO[] = []
  for (const doc of docs) {
    const id = String(doc._id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(toDto(doc))
  }
  return out
}

export const labelService = new LabelService()
