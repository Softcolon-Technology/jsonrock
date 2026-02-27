import { Router } from 'express'
import { upload } from '../utils/multer'
import { ShareController } from '../controllers/share.controller'
import { validate } from '../utils/validator.utils'
import {
  createShareSchema,
  getShareMetaSchema,
  unlockShareSchema,
  updateShareSchema,
  getRawShareSchema,
} from '../validators/share.validation'

const router: Router = Router()
const shareController = new ShareController()

// Routes
// Note: Order matters. More specific routes first.

// /api/share endpoints (Metadata, Unlock, Update)
router.post('/share', validate(createShareSchema), shareController.createShare)

router.get(
  '/share/:slug',
  validate(getShareMetaSchema),
  shareController.getShareMetaData
)
router.post(
  '/share/:slug',
  validate(unlockShareSchema),
  shareController.unlockShare
)
router.put(
  '/share/:slug',
  validate(updateShareSchema),
  shareController.updateShare
)

// /api/upload
router.post('/upload', upload.single('file'), shareController.uploadShare)

// /api/:slug (Raw Fetch) - Must be last to avoid collision if possible, though /share prefix handles it.
router.get('/:slug', validate(getRawShareSchema), shareController.getRawShare)

export default router
