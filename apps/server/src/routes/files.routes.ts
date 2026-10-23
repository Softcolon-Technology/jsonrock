import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { FilesController } from '../controllers/files.controller'
import { requireAuth } from '../middlewares/auth.middleware'
import { validate } from '../utils/validator.utils'
import { getFileMetaSchema } from '../validators/files.validation'

const router: Router = Router()
const controller = new FilesController()

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
})

// GET /api/files
router.get('/', readLimiter, requireAuth, controller.listFiles)

// GET /api/files/:slug — single-file meta (editor header)
router.get(
  '/:slug',
  readLimiter,
  requireAuth,
  validate(getFileMetaSchema),
  controller.getFile
)

export default router
