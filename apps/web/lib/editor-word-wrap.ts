export const WORD_WRAP_STORAGE_KEY = 'jsonrock_editor_word_wrap'
export const WORD_WRAP_CHANGE_EVENT = 'jsonrock-word-wrap-change'

export function readWordWrapPreference(): boolean {
  try {
    return localStorage.getItem(WORD_WRAP_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWordWrapPreference(enabled: boolean) {
  try {
    localStorage.setItem(WORD_WRAP_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Ignore quota / private-mode failures — preference just won't persist.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WORD_WRAP_CHANGE_EVENT))
  }
}
