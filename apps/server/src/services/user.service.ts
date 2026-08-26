import { randomBytes } from 'crypto'
import User, { IUser } from '../models/user.model'

function generateKeyWrapSecret(): string {
  return randomBytes(32).toString('base64')
}

export class UserService {
  /**
   * Returns the per-user key-wrap secret for a Clerk user, creating the user
   * row and/or secret on first use (backfill).
   */
  async getOrCreateKeyWrapSecret(clerkId: string): Promise<string> {
    const existing = await User.findOne({ clerkId })
    if (existing?.keyWrapSecret) {
      return existing.keyWrapSecret
    }

    if (existing) {
      existing.keyWrapSecret = generateKeyWrapSecret()
      await existing.save()
      return existing.keyWrapSecret
    }

    const created: IUser = await User.create({
      clerkId,
      email: `pending+${clerkId}@users.local`,
      keyWrapSecret: generateKeyWrapSecret(),
    })
    return created.keyWrapSecret as string
  }
}
