import { isProjectsEnabled } from '@/lib/feature-flags'

/**
 * Where "home" should land for a signed-in user.
 * With projects enabled, the Workspace library (`/workspace`) is the app home.
 */
export function signedInHomePath(): string {
  return isProjectsEnabled ? '/workspace' : '/'
}
