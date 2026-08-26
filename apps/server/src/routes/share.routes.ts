import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { upload } from '../utils/multer'
import { ShareController } from '../controllers/share.controller'
import { validate } from '../utils/validator.utils'
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware'
import {
  createShareSchema,
  getShareMetaSchema,
  unlockShareSchema,
  updateShareSchema,
  getRawShareSchema,
  shareEmailSchema,
  ownerUnlockSchema,
} from '../validators/share.validation'

const router: Router = Router()
const shareController = new ShareController()

// Apply optional Clerk auth verification to all routes
router.use(optionalAuth)

/**
 * Write rate limiter — applied to POST/PUT/upload endpoints.
 * 30 requests per minute per IP is generous enough for the 2-second auto-save
 * debounce (max ~30 saves/min during heavy typing) while blocking scripted abuse.
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: 'draft-8', // RateLimit-* headers
  legacyHeaders: false,
  message: {
    error:
      'Too many requests. You have exceeded the save/create limit (30 per minute). Please slow down.',
  },
})

/**
 * Read rate limiter — applied to GET endpoints.
 * 300 requests per minute per IP; high enough to never bother legitimate page
 * loads or SSR fetches but will catch pathological crawlers.
 */
const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many read requests. Please slow down.',
  },
})

// Routes
// Note: Order matters. More specific routes first.

// /api/share endpoints (Metadata, Unlock, Update)
router.post(
  '/share',
  writeLimiter,
  validate(createShareSchema),
  shareController.createShare
)

router.post(
  '/share/email',
  writeLimiter,
  requireAuth,
  validate(shareEmailSchema),
  shareController.sendShareEmail
)

router.get(
  '/share/key-wrap-secret',
  readLimiter,
  requireAuth,
  shareController.getKeyWrapSecret
)

router.get(
  '/share/:slug/owner-unlock',
  readLimiter,
  requireAuth,
  validate(ownerUnlockSchema),
  shareController.getOwnerUnlock
)

router.get(
  '/share/:slug',
  readLimiter,
  validate(getShareMetaSchema),
  shareController.getShareMetaData
)
router.post(
  '/share/:slug',
  writeLimiter,
  validate(unlockShareSchema),
  shareController.unlockShare
)
router.put(
  '/share/:slug',
  writeLimiter,
  validate(updateShareSchema),
  shareController.updateShare
)

// /api/upload
router.post(
  '/upload',
  writeLimiter,
  upload.single('file'),
  shareController.uploadShare
)

// /api/:slug (Raw Fetch) - Must be last to avoid collision if possible, though /share prefix handles it.
router.get(
  '/:slug',
  readLimiter,
  validate(getRawShareSchema),
  shareController.getRawShare
)

export default router
