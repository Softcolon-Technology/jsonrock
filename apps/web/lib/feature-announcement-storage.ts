import type { FeatureAnnouncement } from './feature-announcements'

const SEEN_STORAGE_KEY = 'jsonrock:feature-announcements:seen'
const VISIT_COUNT_KEY = 'jsonrock:site-visits'
const VISIT_COUNTED_SESSION_KEY = 'jsonrock:site-visit-counted'

export function getSeenAnnouncementIds(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

export function markAnnouncementSeen(id: string): void {
  if (typeof window === 'undefined') return

  const seen = new Set(getSeenAnnouncementIds())
  seen.add(id)

  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seen]))
  } catch {
    // Ignore quota / private-mode failures; modal simply won't persist dismiss.
  }
}

/**
 * Count distinct browser sessions (once per tab lifetime via sessionStorage).
 * First visit → 1; closing the tab and returning → 2, etc.
 */
export function noteSiteVisit(): number {
  if (typeof window === 'undefined') return 0

  try {
    const alreadyCounted =
      sessionStorage.getItem(VISIT_COUNTED_SESSION_KEY) === '1'
    const current = Number(localStorage.getItem(VISIT_COUNT_KEY) || '0')
    const visits = Number.isFinite(current) && current > 0 ? current : 0

    if (alreadyCounted) return visits || 1

    const next = visits + 1
    localStorage.setItem(VISIT_COUNT_KEY, String(next))
    sessionStorage.setItem(VISIT_COUNTED_SESSION_KEY, '1')
    return next
  } catch {
    // Private mode / blocked storage — treat as first visit (no modal).
    return 1
  }
}

/** Feature modals only after the user has returned for a second session. */
export function canShowFeatureAnnouncements(): boolean {
  return noteSiteVisit() >= 2
}

/** Newest unseen active announcement (last matching entry in the config array). */
export function getNextAnnouncement(
  announcements: FeatureAnnouncement[]
): FeatureAnnouncement | null {
  if (!canShowFeatureAnnouncements()) return null

  const seen = new Set(getSeenAnnouncementIds())

  for (let i = announcements.length - 1; i >= 0; i--) {
    const announcement = announcements[i]
    if (announcement && announcement.active && !seen.has(announcement.id)) {
      return announcement
    }
  }

  return null
}
