import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextFetchEvent, NextRequest } from 'next/server'

const clerkHandler = clerkMiddleware()

// [AUTH-DEBUG] TEMP — remove after diagnosing stuck auth-loading
// Note: this logs on the SERVER (hosting/runtime logs), not in the browser DevTools console.
async function proxy(request: NextRequest, event: NextFetchEvent) {
  console.log('[AUTH-DEBUG] proxy invoked', {
    path: request.nextUrl.pathname,
    method: request.method,
  })
  return clerkHandler(request, event)
}

export default proxy
export { proxy }

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and webhooks
    '/((?!_next|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes except webhooks
    '/(api(?!/webhooks)|trpc)(.*)',
  ],
}
