import { Router } from 'express'
import express from 'express'
import { WebhookController } from '../controllers/webhook.controller'

const router: Router = Router()
const webhookController = new WebhookController()

// Webhook endpoint requires raw body for Svix cryptographic signature verification
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  webhookController.handleClerkWebhook
)

export default router
