import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IFileLabel extends Document {
  name: string
  /** Hex color, e.g. #3b82f6 */
  color: string
  /** Seeded defaults cannot be deleted. */
  isDefault: boolean
  /**
   * Personal library catalog (standalone files). Mutually exclusive with
   * `projectId`.
   */
  ownerId?: string
  /** Project catalog. Mutually exclusive with `ownerId`. */
  projectId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_FILE_LABELS: ReadonlyArray<{
  name: string
  color: string
}> = [
  { name: 'docs', color: '#8b5cf6' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'bug', color: '#ef4444' },
  { name: 'general', color: '#64748b' },
]

const FileLabelSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    color: {
      type: String,
      required: true,
      trim: true,
      maxlength: 7,
      default: '#64748b',
    },
    isDefault: { type: Boolean, default: false },
    ownerId: { type: String, index: true },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
  },
  { timestamps: true }
)

FileLabelSchema.index(
  { ownerId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { ownerId: { $type: 'string' } },
  }
)
FileLabelSchema.index(
  { projectId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { projectId: { $type: 'objectId' } },
  }
)

export default mongoose.model<IFileLabel>(
  'FileLabel',
  FileLabelSchema,
  'file_labels'
)
