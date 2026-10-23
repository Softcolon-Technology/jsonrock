import { Response } from 'express'
import logger from '../config/logger'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { HttpError, ProjectService } from '../services/project.service'

const projectService = new ProjectService()

export function sendError(
  res: Response,
  error: unknown,
  context: string
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  logger.error(`${context} failed`, error)
  res.status(500).json({ error: 'Internal server error' })
}

/** Returns the Clerk user id or responds 401 and returns null. */
export function currentUserId(
  req: AuthenticatedRequest,
  res: Response
): string | null {
  const userId = req.auth?.userId
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' })
    return null
  }
  return userId
}

export class FilesController {
  /** GET /api/files */
  async listFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      res.json(await projectService.listLibrary(userId))
    } catch (error) {
      sendError(res, error, 'List files')
    }
  }

  /** GET /api/files/:slug — file + optional project for the editor chrome. */
  async getFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      res.json(
        await projectService.getFileMeta(req.params.slug as string, userId)
      )
    } catch (error) {
      sendError(res, error, 'Get file')
    }
  }

  /** PATCH /api/share/:slug  body { title?, projectId?: string | null } */
  async patchShare(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      const { title, projectId } = req.body as {
        title?: string
        projectId?: string | null
      }
      const file = await projectService.patchShare(
        req.params.slug as string,
        userId,
        { title, projectId }
      )
      res.json({ ok: true, file })
    } catch (error) {
      sendError(res, error, 'Patch share')
    }
  }

  /** DELETE /api/share/:slug */
  async deleteShare(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      await projectService.deleteShare(req.params.slug as string, userId)
      res.json({ ok: true })
    } catch (error) {
      sendError(res, error, 'Delete share')
    }
  }
}
