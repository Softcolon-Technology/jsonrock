import mongoose, { Schema, Document } from 'mongoose'

export interface IProject extends Document {
  name: string
  /** Clerk user id of the (primary) owner. */
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

const ProjectSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: String, required: true, index: true },
  },
  { timestamps: true }
)

export default mongoose.model<IProject>('Project', ProjectSchema, 'projects')
