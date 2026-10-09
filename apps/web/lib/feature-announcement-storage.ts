import type { FeatureAnnouncement } from './feature-announcements'

const SEEN_STORAGE_KEY = 'jsonrock:feature-announcements:seen'

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

/** Newest unseen active announcement (last matching entry in the config array). */
export function getNextAnnouncement(
  announcements: FeatureAnnouncement[]
): FeatureAnnouncement | null {
  const seen = new Set(getSeenAnnouncementIds())

  for (let i = announcements.length - 1; i >= 0; i--) {
    const announcement = announcements[i]
    if (announcement && announcement.active && !seen.has(announcement.id)) {
      return announcement
    }
  }

  return null
}
