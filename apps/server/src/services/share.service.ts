import ShareLink, {
  IShareLink,
  JsonShareMode,
  ShareAccessType,
  ShareType,
} from '../models/share.model'
import { generateSlug } from '../utils/slug.utils'
import { createHash, timingSafeEqual } from 'crypto'
import { ModeEnum, AccessTypeEnum, ShareTypeEnum } from '../enums/enum'

interface CreateShareInput {
  json?: string
  mode?: JsonShareMode
  isPrivate: boolean
  accessType?: ShareAccessType
  password?: string
  type?: ShareType
  slug?: string
}

export class ShareService {
  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex')
  }

  async createShareLink(input: CreateShareInput): Promise<IShareLink> {
    let slug = input.slug
    if (!slug) {
      slug = generateSlug()
      // Ensure uniqueness
      while (await ShareLink.findOne({ slug })) {
        slug = generateSlug()
      }
    }

    const passwordHash =
      input.isPrivate && input.password
        ? this.hashPassword(input.password)
        : undefined

    const shareLink = new ShareLink({
      slug,
      type: input.type || ShareTypeEnum.JSON,
      json: input.json || '',
      mode: input.mode || ModeEnum.FORMATTER,
      isPrivate: input.isPrivate,
      accessType: input.accessType || AccessTypeEnum.VIEWER,
      passwordHash,
    })

    return shareLink.save()
  }

  getShareLink(slug: string): Promise<IShareLink | null> {
    return ShareLink.findOne({ slug })
  }

  updateShareLink(
    slug: string,
    input: Partial<CreateShareInput>
  ): Promise<IShareLink | null> {
    const updateDoc: Record<string, unknown> = {
      json: input.json,
      mode: input.mode,
      isPrivate: input.isPrivate,
      accessType: input.accessType || AccessTypeEnum.VIEWER,
    }

    if (input.type) {
      updateDoc.type = input.type
    }

    if (input.isPrivate && input.password) {
      updateDoc.passwordHash = this.hashPassword(input.password)
    } else if (input.isPrivate === false) {
      updateDoc.passwordHash = null
    }

    return ShareLink.findOneAndUpdate(
      { slug },
      { $set: updateDoc },
      { new: true }
    )
  }

  verifyPassword(record: IShareLink, password: string): boolean {
    if (!record.isPrivate || !record.passwordHash) return false

    const provided = this.hashPassword(password)
    const stored = record.passwordHash

    try {
      return timingSafeEqual(
        Buffer.from(provided, 'hex'),
        Buffer.from(stored, 'hex')
      )
    } catch {
      return false
    }
  }
}
