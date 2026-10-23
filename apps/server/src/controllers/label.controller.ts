import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { labelService } from '../services/label.service'
import { currentUserId, sendError } from './files.controller'

export class LabelController {
  /** GET /api/labels?projectId= */
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      const projectId =
        typeof req.query.projectId === 'string' && req.query.projectId
          ? req.query.projectId
          : null
      const labels = await labelService.listForUser(userId, projectId)
      res.json({ labels })
    } catch (error) {
      sendError(res, error, 'List labels')
    }
  }

  /** POST /api/labels */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      const { name, color, projectId } = req.body as {
        name: string
        color?: string
        projectId?: string | null
      }
      const label = await labelService.create(userId, {
        name,
        color,
        projectId: projectId ?? null,
      })
      res.status(201).json({ label })
    } catch (error) {
      sendError(res, error, 'Create label')
    }
  }

  /** DELETE /api/labels/:id */
  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      await labelService.remove(userId, req.params.id as string)
      res.json({ ok: true })
    } catch (error) {
      sendError(res, error, 'Delete label')
    }
  }

  /** PUT /api/files/:slug/labels  body { labelIds: string[] } */
  async setFileLabels(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      const { labelIds } = req.body as { labelIds: string[] }
      const result = await labelService.setFileLabels(
        userId,
        req.params.slug as string,
        labelIds ?? []
      )
      res.json(result)
    } catch (error) {
      sendError(res, error, 'Set file labels')
    }
  }
}
