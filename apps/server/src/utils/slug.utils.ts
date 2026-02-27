import { randomBytes } from 'crypto'

export function generateSlug(): string {
  return randomBytes(6).toString('base64url')
}
