// Web Crypto API utilities for End-to-End Encryption (AES-256-GCM + PBKDF2)

const PBKDF2_ITERATIONS = 100_000

// Helper functions for ArrayBuffer <-> Base64 / Base64URL conversions

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  return bufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  return base64ToBuffer(base64)
}

/**
 * Generates a random 256-bit AES-GCM CryptoKey and exports it as a base64url string.
 */
export async function generateDocumentKey(): Promise<{
  key: CryptoKey
  keyString: string
}> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  const rawKeyBuffer = await window.crypto.subtle.exportKey('raw', key)
  const keyString = bufferToBase64Url(rawKeyBuffer)

  return { key, keyString }
}

/**
 * Imports an AES-GCM CryptoKey from a base64url encoded raw key string (e.g. from #key=...).
 */
export async function importKeyFromFragment(
  keyString: string
): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  const rawKeyBuffer = base64UrlToBuffer(keyString)
  return window.crypto.subtle.importKey(
    'raw',
    rawKeyBuffer as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Generates a random 16-byte salt for PBKDF2 password-based key derivation.
 */
export function generateSalt(): string {
  const saltBytes = new Uint8Array(16)
  window.crypto.getRandomValues(saltBytes)
  return bufferToBase64(saltBytes)
}

/**
 * Derives an AES-256-GCM CryptoKey from a plaintext password and base64 salt using PBKDF2.
 */
export async function deriveKeyFromPassword(
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const saltBuffer = base64ToBuffer(saltBase64)

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    // Extractable so owners can wrap the content key for cross-device unlock.
    true,
    ['encrypt', 'decrypt']
  )
}

export interface EncryptedPayload {
  ciphertext: string // Base64
  iv: string // Base64
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a fresh random 12-byte IV every time.
 */
export async function encryptContent(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // Fresh 12-byte IV for every single encryption operation
  const iv = new Uint8Array(12)
  window.crypto.getRandomValues(iv)

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    data
  )

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
  }
}

/**
 * Decrypts an AES-256-GCM ciphertext using the given CryptoKey and IV.
 */
export async function decryptContent(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  if (!ciphertextBase64) {
    return ''
  }

  const ciphertext = base64ToBuffer(ciphertextBase64)
  const iv = base64ToBuffer(ivBase64)

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

const OWNER_WRAP_SALT = new TextEncoder().encode('jsonrock-owner-wrap-v1')

/**
 * Derives an AES-256-GCM wrapping key from the per-user secret returned by the
 * authenticated key-wrap endpoints (never from the document password).
 */
export async function deriveWrappingKeyFromUserSecret(
  secretBase64: string
): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  const secretBytes = base64ToBuffer(secretBase64)
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    secretBytes as unknown as BufferSource,
    'HKDF',
    false,
    ['deriveKey']
  )

  return window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: OWNER_WRAP_SALT,
      info: new Uint8Array(),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Wraps (encrypts) a document content key for owner recovery.
 * Returns a JSON string `{ciphertext, iv}` suitable for `ownerKeyWrapped`.
 */
export async function wrapContentKey(
  contentKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  const rawKey = await window.crypto.subtle.exportKey('raw', contentKey)
  const iv = new Uint8Array(12)
  window.crypto.getRandomValues(iv)

  const wrapped = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    wrappingKey,
    rawKey
  )

  return JSON.stringify({
    ciphertext: bufferToBase64(wrapped),
    iv: bufferToBase64(iv),
  })
}

/**
 * Unwraps an `ownerKeyWrapped` payload into an AES-GCM content CryptoKey.
 */
export async function unwrapContentKey(
  ownerKeyWrapped: string,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  const parsed = JSON.parse(ownerKeyWrapped) as {
    ciphertext?: string
    iv?: string
  }
  if (!parsed.ciphertext || !parsed.iv) {
    throw new Error('Invalid ownerKeyWrapped payload')
  }

  const ciphertext = base64ToBuffer(parsed.ciphertext)
  const iv = base64ToBuffer(parsed.iv)

  const rawKey = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    wrappingKey,
    ciphertext as unknown as BufferSource
  )

  return window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Extracts the encryption key string from the URL fragment (#key=...).
 */
export function extractKeyFromFragment(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash) return null
  const match = hash.match(/(?:^|#|&)key=([A-Za-z0-9_-]+)/)
  return match?.[1] || null
}

/**
 * Updates the window location fragment with the key without causing a reload or navigation.
 */
export function setKeyInFragment(keyString: string): void {
  if (typeof window === 'undefined') return
  const currentUrl = new URL(window.location.href)
  currentUrl.hash = `key=${keyString}`
  window.history.replaceState(window.history.state, '', currentUrl.toString())
}
