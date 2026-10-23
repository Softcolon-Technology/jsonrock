'use client'

import { useAuth } from '@clerk/nextjs'
import { signedInHomePath } from '@/lib/home'

/** Home href: Library when signed in (projects flag on), otherwise marketing `/`. */
export function useHomeHref(): string {
  const { isSignedIn } = useAuth()
  return isSignedIn ? signedInHomePath() : '/'
}
