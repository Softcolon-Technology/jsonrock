/** Copy text to the clipboard with a legacy fallback when the async API fails. */
export async function writeClipboardText(text: string): Promise<void> {
  try {
    window.focus()
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fall through — some browsers block clipboard without focus / gesture.
  }

  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'fixed'
  el.style.top = '0'
  el.style.left = '0'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  el.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    document.body.removeChild(el)
  }
  if (!ok) {
    throw new Error('CLIPBOARD_UNAVAILABLE')
  }
}
