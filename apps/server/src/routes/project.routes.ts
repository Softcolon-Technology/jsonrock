import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { ProjectController } from '../controllers/project.controller'
import { requireAuth } from '../middlewares/auth.middleware'
import { validate } from '../utils/validator.utils'
import {
  createInviteSchema,
  createProjectSchema,
  inviteTokenParamsSchema,
  memberParamsSchema,
  projectIdParamsSchema,
  renameProjectSchema,
  revokeInviteSchema,
  updateMemberSchema,
} from '../validators/project.validation'

const router: Router = Router()
const controller = new ProjectController()

const inviteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many invite requests. Please slow down.' },
})

router.use(requireAuth)

// NOTE: /invites/* routes must stay above /:id so "invites" is not read as an id.
router.get('/invites/pending', controller.listPendingInvites)
router.get(
  '/invites/:token',
  validate(inviteTokenParamsSchema),
  controller.getInvite
)
router.post(
  '/invites/:token/accept',
  validate(inviteTokenParamsSchema),
  controller.acceptInvite
)
router.post(
  '/invites/:token/decline',
  validate(inviteTokenParamsSchema),
  controller.declineInvite
)

router.get('/', controller.list)
router.post('/', validate(createProjectSchema), controller.create)

router.get('/:id', validate(projectIdParamsSchema), controller.get)
router.patch('/:id', validate(renameProjectSchema), controller.rename)
router.delete('/:id', validate(projectIdParamsSchema), controller.remove)

router.post(
  '/:id/invites',
  inviteLimiter,
  validate(createInviteSchema),
  controller.createInvite
)
router.delete(
  '/:id/invites/:token',
  validate(revokeInviteSchema),
  controller.revokeInvite
)

router.patch(
  '/:id/members/:userId',
  validate(updateMemberSchema),
  controller.updateMember
)
router.delete(
  '/:id/members/:userId',
  validate(memberParamsSchema),
  controller.removeMember
)

export default router
