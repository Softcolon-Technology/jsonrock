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
  schemaVersion?: number
  json?: string
  password?: string
  ciphertext?: string
  iv?: string
  salt?: string
  mode?: JsonShareMode
  isPrivate: boolean
  accessType?: ShareAccessType
  type?: ShareType
  slug?: string
  ownerId?: string
}

export class ShareService {
  hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex')
  }

  verifyLegacyPassword(record: IShareLink, password: string): boolean {
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

  async createShareLink(input: CreateShareInput): Promise<IShareLink> {
    let slug = input.slug
    if (!slug) {
      slug = generateSlug()
      // Ensure uniqueness
      while (await ShareLink.findOne({ slug })) {
        slug = generateSlug()
      }
    }

    const shareLink = new ShareLink({
      slug,
      ownerId: input.ownerId || undefined,
      schemaVersion: input.schemaVersion ?? 2,
      type: input.type || ShareTypeEnum.JSON,
      ciphertext: input.ciphertext || '',
      iv: input.iv || '',
      salt: input.salt || undefined,
      mode: input.mode || ModeEnum.FORMATTER,
      isPrivate: input.isPrivate,
      accessType: input.accessType || AccessTypeEnum.VIEWER,
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
      mode: input.mode,
      isPrivate: input.isPrivate,
      accessType: input.accessType || AccessTypeEnum.VIEWER,
    }

    if (input.ownerId !== undefined) {
      updateDoc.ownerId = input.ownerId
    }

    if (input.schemaVersion !== undefined) {
      updateDoc.schemaVersion = input.schemaVersion
    }

    if (input.ciphertext !== undefined) {
      updateDoc.ciphertext = input.ciphertext
    }

    if (input.iv !== undefined) {
      updateDoc.iv = input.iv
    }

    if (input.salt !== undefined) {
      updateDoc.salt = input.salt
    }

    if (input.type) {
      updateDoc.type = input.type
    }

    // When upgrading/saving a document as schemaVersion 2 (E2EE), explicitly clear legacy plaintext & passwordHash
    if (
      input.schemaVersion === 2 ||
      (input.ciphertext && input.schemaVersion !== 1)
    ) {
      updateDoc.schemaVersion = 2
      updateDoc.json = null
      updateDoc.passwordHash = null
    }

    return ShareLink.findOneAndUpdate(
      { slug },
      { $set: updateDoc },
      { new: true }
    )
  }
}
