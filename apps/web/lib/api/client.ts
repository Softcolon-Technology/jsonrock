export type TokenGetter = () => Promise<string | null>

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not_found' | 'http'

export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.kind =
      status === 401
        ? 'unauthorized'
        : status === 403
          ? 'forbidden'
          : status === 404
            ? 'not_found'
            : 'http'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  getToken?: TokenGetter
  signal?: AbortSignal
}

/**
 * Thin fetch wrapper for the JsonRock API. Paths are relative to `/api`
 * (Next.js rewrites `/api/*` to the backend), e.g. `apiFetch('/projects')`.
 */
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, getToken, signal }: ApiRequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (getToken) {
    const token = await getToken()
    if (!token) throw new ApiError(401, 'Sign in to continue.')
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : res.status === 401
          ? 'Sign in to continue.'
          : res.status === 403
            ? 'You do not have permission to do that.'
            : `Request failed (${res.status})`
    throw new ApiError(res.status, message, data)
  }

  return data as T
}
