import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  clerkId: string
  email: string
  name?: string
  avatarUrl?: string
  deletedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const UserSchema: Schema = new Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
    },
    avatarUrl: {
      type: String,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

export default mongoose.model<IUser>('User', UserSchema, 'users')
