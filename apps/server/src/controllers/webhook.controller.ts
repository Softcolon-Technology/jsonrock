import { Request, Response } from 'express'
import { Webhook } from 'svix'
import User from '../models/user.model'
import logger from '../config/logger'

interface ClerkEmailAddress {
  id: string
  email_address: string
}

interface ClerkUserData {
  id: string
  email_addresses?: ClerkEmailAddress[]
  primary_email_address_id?: string
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  image_url?: string | null
  profile_image_url?: string | null
  deleted?: boolean
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | string
  data: ClerkUserData
}

export class WebhookController {
  public handleClerkWebhook = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

    if (!webhookSecret) {
      logger.error(
        'CLERK_WEBHOOK_SECRET is not defined in environment variables'
      )
      res
        .status(500)
        .json({ error: 'Webhook secret is not configured on server' })
      return
    }

    const svixId = req.headers['svix-id'] as string
    const svixTimestamp = req.headers['svix-timestamp'] as string
    const svixSignature = req.headers['svix-signature'] as string

    if (!svixId || !svixTimestamp || !svixSignature) {
      logger.warn('Missing svix webhook headers in incoming request')
      res.status(400).json({ error: 'Missing svix verification headers' })
      return
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body)

    let evt: ClerkWebhookEvent

    try {
      const wh = new Webhook(webhookSecret)
      evt = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.warn('Clerk webhook signature verification failed:', {
        message: errorMessage,
      })
      res.status(400).json({ error: 'Invalid webhook signature' })
      return
    }

    const { type, data } = evt
    logger.info(`Received Clerk webhook event: ${type}`, { userId: data?.id })

    try {
      switch (type) {
        case 'user.created': {
          const primaryEmailId = data.primary_email_address_id
          const primaryEmailObj = data.email_addresses?.find(
            (item) => item.id === primaryEmailId
          )
          const email =
            primaryEmailObj?.email_address ||
            data.email_addresses?.[0]?.email_address ||
            ''

          const name =
            [data.first_name, data.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            data.username ||
            undefined

          const avatarUrl =
            data.image_url || data.profile_image_url || undefined

          await User.findOneAndUpdate(
            { clerkId: data.id },
            {
              $set: {
                clerkId: data.id,
                email,
                name,
                avatarUrl,
                deletedAt: null,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          )
          logger.info(`Synced user.created to local MongoDB: ${data.id}`)
          break
        }

        case 'user.updated': {
          const primaryEmailId = data.primary_email_address_id
          const primaryEmailObj = data.email_addresses?.find(
            (item) => item.id === primaryEmailId
          )
          const email =
            primaryEmailObj?.email_address ||
            data.email_addresses?.[0]?.email_address ||
            ''

          const name =
            [data.first_name, data.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            data.username ||
            undefined

          const avatarUrl =
            data.image_url || data.profile_image_url || undefined

          await User.findOneAndUpdate(
            { clerkId: data.id },
            {
              $set: {
                email,
                name,
                avatarUrl,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          )
          logger.info(`Synced user.updated to local MongoDB: ${data.id}`)
          break
        }

        case 'user.deleted': {
          // Soft delete: preserve record with deletedAt timestamp to avoid breaking ownerId links
          await User.findOneAndUpdate(
            { clerkId: data.id },
            {
              $set: {
                deletedAt: new Date(),
              },
            }
          )
          logger.info(
            `Soft-deleted user in local MongoDB on user.deleted: ${data.id}`
          )
          break
        }

        default: {
          logger.info(`Ignored unhandled Clerk webhook event: ${type}`)
          break
        }
      }

      res.status(200).json({ received: true })
    } catch (dbError) {
      const errorMessage =
        dbError instanceof Error ? dbError.message : String(dbError)
      logger.error('Failed to persist Clerk webhook event in MongoDB:', {
        eventType: type,
        userId: data?.id,
        error: errorMessage,
      })
      res
        .status(500)
        .json({ error: 'Internal server error processing webhook' })
    }
  }
}
