import mongoose, { Schema, Document } from 'mongoose'
import { ModeEnum, AccessTypeEnum, ShareTypeEnum } from '../enums/enum'

export type JsonShareMode = 'visualize' | 'tree' | 'formatter'
export type ShareAccessType = 'editor' | 'viewer'
export type ShareType = 'json' | 'text'

export interface IShareLink extends Document {
  slug: string
  type: ShareType
  json: string
  mode: JsonShareMode
  isPrivate: boolean
  accessType: ShareAccessType
  passwordHash?: string
  createdAt: Date
  updatedAt: Date
}

const ShareLinkSchema: Schema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: ShareTypeEnum, default: ShareTypeEnum.JSON },
    json: { type: String },
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
    passwordHash: { type: String },
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
