import mongoose, { Schema, Document } from 'mongoose'
import { ModeEnum, AccessTypeEnum, ShareTypeEnum } from '../enums/enum'

export type JsonShareMode = 'visualize' | 'tree' | 'formatter'
export type ShareAccessType = 'editor' | 'viewer'
export type ShareType = 'json' | 'text' | 'markdown' | 'html'

export interface IShareLink extends Document {
  slug: string
  ownerId?: string // Clerk User ID
  type: ShareType
  schemaVersion?: number // 1 = legacy plaintext, 2 = E2EE AES-256-GCM
  json?: string // Legacy plaintext content
  passwordHash?: string // Legacy SHA-256 password hash
  ciphertext?: string
  iv?: string
  salt?: string
  mode: JsonShareMode
  isPrivate: boolean
  accessType: ShareAccessType
  createdAt: Date
  updatedAt: Date
}

const ShareLinkSchema: Schema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    ownerId: { type: String },
    type: { type: String, enum: ShareTypeEnum, default: ShareTypeEnum.JSON },
    schemaVersion: { type: Number },
    json: { type: String },
    passwordHash: { type: String },
    ciphertext: { type: String },
    iv: { type: String },
    salt: { type: String },
    mode: {
      type: String,
      enum: ModeEnum,
      required: true,
    },
    isPrivate: { type: Boolean, default: false },
    accessType: {
      type: String,
      enum: AccessTypeEnum,
      default: AccessTypeEnum.VIEWER,
    },
  },
  { timestamps: true }
)

// TTL Index for 30 days
ShareLinkSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
)

export default mongoose.model<IShareLink>(
  'ShareLink',
  ShareLinkSchema,
  'share_links'
)
