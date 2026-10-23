/**
 * Lightweight unit checks for ApiError 401/403 classification.
 * Run: `npx tsx lib/api/client.test.ts` from apps/web.
 */
import { ApiError, isApiError } from './client'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const unauthorized = new ApiError(401, 'Sign in to continue.')
assert(unauthorized.kind === 'unauthorized', '401 → unauthorized')
assert(isApiError(unauthorized), 'instanceof ApiError')

const forbidden = new ApiError(403, 'No permission.')
assert(forbidden.kind === 'forbidden', '403 → forbidden')

const notFound = new ApiError(404, 'Missing.')
assert(notFound.kind === 'not_found', '404 → not_found')

const other = new ApiError(500, 'Boom.')
assert(other.kind === 'http', '500 → http')

console.log('api/client.test.ts: ok')
