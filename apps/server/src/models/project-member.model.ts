import mongoose, { Schema, Document, Types } from 'mongoose'

export type ProjectRole = 'owner' | 'editor' | 'viewer'
export const PROJECT_ROLES: ProjectRole[] = ['owner', 'editor', 'viewer']

export interface IProjectMember extends Document {
  projectId: Types.ObjectId
  /** Clerk user id. */
  userId: string
  role: ProjectRole
  createdAt: Date
  updatedAt: Date
}

const ProjectMemberSchema: Schema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: PROJECT_ROLES, required: true },
  },
  { timestamps: true }
)

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true })

export default mongoose.model<IProjectMember>(
  'ProjectMember',
  ProjectMemberSchema,
  'project_members'
)
