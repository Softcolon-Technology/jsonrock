import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { LabelController } from '../controllers/label.controller'
import { requireAuth } from '../middlewares/auth.middleware'
import { validate } from '../utils/validator.utils'
import {
  createLabelSchema,
  deleteLabelSchema,
  listLabelsSchema,
  setFileLabelsSchema,
} from '../validators/label.validation'

const router: Router = Router()
const controller = new LabelController()

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
})

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
})

router.get(
  '/',
  readLimiter,
  requireAuth,
  validate(listLabelsSchema),
  controller.list
)
router.post(
  '/',
  writeLimiter,
  requireAuth,
  validate(createLabelSchema),
  controller.create
)
router.delete(
  '/:id',
  writeLimiter,
  requireAuth,
  validate(deleteLabelSchema),
  controller.remove
)

export const fileLabelsRouter: Router = Router()
fileLabelsRouter.put(
  '/:slug/labels',
  writeLimiter,
  requireAuth,
  validate(setFileLabelsSchema),
  controller.setFileLabels
)

export default router
