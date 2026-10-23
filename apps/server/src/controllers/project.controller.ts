import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { ProjectService } from '../services/project.service'
import { currentUserId, sendError } from './files.controller'

const projectService = new ProjectService()

type Handler = (req: AuthenticatedRequest, res: Response) => Promise<void>

/** Wrap a handler: resolve the caller, run it, map errors to `{ error }`. */
function handle(
  context: string,
  fn: (
    userId: string,
    req: AuthenticatedRequest,
    res: Response
  ) => Promise<void>
): Handler {
  return async (req, res) => {
    const userId = currentUserId(req, res)
    if (!userId) return
    try {
      await fn(userId, req, res)
    } catch (error) {
      sendError(res, error, context)
    }
  }
}

export class ProjectController {
  list = handle('List projects', async (userId, _req, res) => {
    res.json({ projects: await projectService.listProjects(userId) })
  })

  create = handle('Create project', async (userId, req, res) => {
    const project = await projectService.createProject(userId, req.body.name)
    res.status(201).json({ project })
  })

  get = handle('Get project', async (userId, req, res) => {
    res.json(
      await projectService.getProjectDetail(req.params.id as string, userId)
    )
  })

  rename = handle('Rename project', async (userId, req, res) => {
    const project = await projectService.renameProject(
      req.params.id as string,
      userId,
      req.body.name
    )
    res.json({ project })
  })

  remove = handle('Delete project', async (userId, req, res) => {
    await projectService.deleteProject(req.params.id as string, userId)
    res.json({ ok: true })
  })

  /* ------------------------------- invites -------------------------------- */

  createInvite = handle('Create invite', async (userId, req, res) => {
    const { invite, emailSent } = await projectService.createInvite(
      req.params.id as string,
      userId,
      req.body
    )
    res.json({ invite, emailSent })
  })

  revokeInvite = handle('Revoke invite', async (userId, req, res) => {
    await projectService.revokeInvite(
      req.params.id as string,
      userId,
      req.params.token as string
    )
    res.json({ ok: true })
  })

  listPendingInvites = handle(
    'List pending invites',
    async (userId, _req, res) => {
      res.json({ invites: await projectService.listPendingInvites(userId) })
    }
  )

  getInvite = handle('Get invite', async (userId, req, res) => {
    const invite = await projectService.getInvitePreview(
      req.params.token as string,
      userId
    )
    res.json({ invite })
  })

  acceptInvite = handle('Accept invite', async (userId, req, res) => {
    const result = await projectService.acceptInvite(
      req.params.token as string,
      userId
    )
    res.json({ ok: true, ...result })
  })

  declineInvite = handle('Decline invite', async (userId, req, res) => {
    await projectService.declineInvite(req.params.token as string, userId)
    res.json({ ok: true })
  })

  /* ------------------------------- members -------------------------------- */

  updateMember = handle('Update member', async (userId, req, res) => {
    await projectService.updateMemberRole(
      req.params.id as string,
      userId,
      req.params.userId as string,
      req.body.role
    )
    res.json({ ok: true })
  })

  removeMember = handle('Remove member', async (userId, req, res) => {
    await projectService.removeMember(
      req.params.id as string,
      userId,
      req.params.userId as string
    )
    res.json({ ok: true })
  })
}
