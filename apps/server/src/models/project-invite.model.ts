import mongoose, { Schema, Document, Types } from 'mongoose'

export type InviteRole = 'editor' | 'viewer'
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked'

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

export interface IProjectInvite extends Document {
  projectId: Types.ObjectId
  /** Normalized (trimmed, lower-cased) invitee email. */
  email: string
  role: InviteRole
  token: string
  invitedByUserId: string
  invitedByName: string
  status: InviteStatus
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const ProjectInviteSchema: Schema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['editor', 'viewer'], required: true },
    token: { type: String, required: true, unique: true },
    invitedByUserId: { type: String, required: true },
    invitedByName: { type: String, default: 'Someone' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'revoked'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + INVITE_TTL_MS),
    },
  },
  { timestamps: true }
)

ProjectInviteSchema.index({ projectId: 1, email: 1, status: 1 })
ProjectInviteSchema.index({ email: 1, status: 1 })

export default mongoose.model<IProjectInvite>(
  'ProjectInvite',
  ProjectInviteSchema,
  'project_invites'
)
