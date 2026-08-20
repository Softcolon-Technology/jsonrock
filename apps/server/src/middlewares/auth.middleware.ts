import { verifyToken } from '@clerk/backend'
import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger'

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string
  }
}

/**
 * Optional Auth middleware - verifies Clerk Bearer token if present.
 * If token is valid, attaches req.auth = { userId }.
 * If no token is provided, proceeds anonymously (req.auth remains undefined).
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next()
    return
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    next()
    return
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    next()
    return
  }

  try {
    const verified = await verifyToken(token, { secretKey })
    if (verified && verified.sub) {
      req.auth = { userId: verified.sub }
    }
  } catch (error) {
    logger.warn('Clerk optional token verification failed:', error)
  }
  next()
}

/**
 * Strict Auth middleware - enforces Clerk authentication on specific endpoints.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to share.',
    })
    return
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: 'Authentication token missing.' })
    return
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    logger.warn(
      'CLERK_SECRET_KEY is not defined in server environment; allowing request in dev.'
    )
    next()
    return
  }

  try {
    const verified = await verifyToken(token, { secretKey })
    if (!verified || !verified.sub) {
      res.status(401).json({ error: 'Invalid authentication token.' })
      return
    }
    req.auth = { userId: verified.sub }
    next()
  } catch (error) {
    logger.error('Clerk token verification error:', error)
    res.status(401).json({
      error: 'Invalid or expired authentication session. Please sign in again.',
    })
  }
}
