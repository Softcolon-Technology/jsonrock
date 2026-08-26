import { Request, Response } from 'express'
import { ShareService } from '../services/share.service'
import { UserService } from '../services/user.service'
import { sendShareLinkEmail } from '../services/email.service'
import logger from '../config/logger'
import { ShareTypeEnum, ModeEnum, AccessTypeEnum } from '../enums/enum'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'

const shareService = new ShareService()
const userService = new UserService()

// Multer types from @types/multer
interface MulterRequest extends Request {
  file?: Express.Multer.File
}

function withPreviewOnly<T extends Record<string, unknown>>(
  record: { previewOnly?: boolean },
  payload: T
): T & { previewOnly: boolean } {
  return {
    ...payload,
    previewOnly: record.previewOnly === true,
  }
}

/** Public share fields — never includes ownerKeyWrapped or keyWrapSecret. */
function withOwnerMeta<T extends Record<string, unknown>>(
  record: { ownerId?: string; ownerKeyWrapped?: string },
  payload: T
): T & { ownerId: string | null; hasOwnerKeyWrapped: boolean } {
  return {
    ...payload,
    ownerId: record.ownerId || null,
    hasOwnerKeyWrapped: Boolean(record.ownerKeyWrapped),
  }
}

export class ShareController {
  async createShare(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        schemaVersion,
        ciphertext,
        iv,
        salt,
        ownerKeyWrapped,
        mode,
        isPrivate,
        accessType,
        previewOnly,
        type,
        slug,
      } = req.body

      const ownerId = req.auth?.userId

      const record = await shareService.createShareLink({
        ownerId,
        schemaVersion: schemaVersion ?? 2,
        ciphertext: ciphertext || '',
        iv: iv || '',
        salt: salt || undefined,
        ownerKeyWrapped:
          isPrivate === true && ownerId && ownerKeyWrapped
            ? ownerKeyWrapped
            : undefined,
        mode: mode || ModeEnum.FORMATTER,
        isPrivate: isPrivate || false,
        accessType: accessType || AccessTypeEnum.VIEWER,
        previewOnly: previewOnly === true,
        type: type || ShareTypeEnum.JSON,
        slug,
      })

      res.json(
        withOwnerMeta(
          record,
          withPreviewOnly(record, {
            slug: record.slug,
            ownerId: record.ownerId,
            schemaVersion: record.schemaVersion ?? 2,
            mode: record.mode,
            type: record.type,
            isPrivate: record.isPrivate,
            accessType: record.accessType,
            ciphertext: record.ciphertext,
            iv: record.iv,
            salt: record.salt,
          })
        )
      )
    } catch (error) {
      logger.error('Error creating share link', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  async sendShareEmail(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.auth?.userId
      if (!userId) {
        res.status(401).json({
          error: 'Authentication required. Please sign in to share.',
        })
        return
      }

      const { recipientEmail, shareUrl, documentTitle } = req.body

      const result = await sendShareLinkEmail({
        recipientEmail,
        shareUrl,
        documentTitle: documentTitle || 'Untitled document',
        senderUserId: userId,
      })

      res.json({
        success: true,
        id: result.id,
        message: 'Email sent successfully.',
      })
    } catch (error) {
      logger.error('Error sending share email', error)
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to send share email',
      })
    }
  }

  /**
   * Authenticated owner-only: returns ownerKeyWrapped + keyWrapSecret so the
   * client can unwrap the content key and skip the password prompt.
   */
  async getOwnerUnlock(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.auth?.userId
      if (!userId) {
        res.status(401).json({ error: 'Authentication required.' })
        return
      }

      const { slug } = req.params
      const record = await shareService.getShareLink(slug as string)

      if (!record) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      if (!record.isPrivate) {
        res.status(400).json({ error: 'Document is not password-protected.' })
        return
      }

      if (!record.ownerId || record.ownerId !== userId) {
        res.status(403).json({ error: 'Not the document owner.' })
        return
      }

      if (!record.ownerKeyWrapped) {
        res.status(404).json({
          error: 'No owner key wrap available for this document.',
        })
        return
      }

      const keyWrapSecret = await userService.getOrCreateKeyWrapSecret(userId)

      res.json({
        ownerKeyWrapped: record.ownerKeyWrapped,
        keyWrapSecret,
      })
    } catch (error) {
      logger.error('Owner unlock error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  /**
   * Authenticated: returns (or creates) the caller's key-wrap secret for
   * wrapping content keys when saving password-protected documents.
   */
  async getKeyWrapSecret(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.auth?.userId
      if (!userId) {
        res.status(401).json({ error: 'Authentication required.' })
        return
      }

      const keyWrapSecret = await userService.getOrCreateKeyWrapSecret(userId)
      res.json({ keyWrapSecret })
    } catch (error) {
      logger.error('Key wrap secret error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async getRawShare(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params
      const password = req.query.password as string | undefined

      const record = await shareService.getShareLink(slug as string)

      if (!record) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      const isLegacy =
        !record.schemaVersion ||
        record.schemaVersion === 1 ||
        (Boolean(record.json) && !record.ciphertext)

      if (isLegacy) {
        if (record.isPrivate) {
          if (!password) {
            res.status(401).json({ error: 'Password is required' })
            return
          }
          const isValid = shareService.verifyLegacyPassword(record, password)
          if (!isValid) {
            res.status(401).json({ error: 'Password is incorrect' })
            return
          }
        }

        let parsedData = record.json
        if (record.type === ShareTypeEnum.JSON && record.json) {
          try {
            parsedData = JSON.parse(record.json)
          } catch {
            parsedData = record.json
          }
        }

        res.json(
          withOwnerMeta(
            record,
            withPreviewOnly(record, {
              slug: record.slug,
              schemaVersion: 1,
              isLegacyPlaintext: true,
              data: parsedData,
              json: record.json,
              type: record.type,
              mode: record.mode,
              isPrivate: record.isPrivate,
              accessType: record.accessType,
            })
          )
        )
        return
      }

      res.json(
        withOwnerMeta(
          record,
          withPreviewOnly(record, {
            slug: record.slug,
            schemaVersion: record.schemaVersion ?? 2,
            isLegacyPlaintext: false,
            ciphertext: record.ciphertext,
            iv: record.iv,
            salt: record.salt,
            type: record.type,
            mode: record.mode,
            isPrivate: record.isPrivate,
            accessType: record.accessType,
          })
        )
      )
    } catch (error) {
      logger.error('API Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async getShareMetaData(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params

      const record = await shareService.getShareLink(slug as string)

      if (!record) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      const isLegacy =
        !record.schemaVersion ||
        record.schemaVersion === 1 ||
        (Boolean(record.json) && !record.ciphertext)

      if (isLegacy) {
        if (record.isPrivate) {
          res.json(
            withOwnerMeta(
              record,
              withPreviewOnly(record, {
                type: record.type,
                data: null,
                json: '',
                slug: record.slug,
                isPrivate: true,
                accessType: record.accessType,
                mode: record.mode,
                schemaVersion: 1,
                isLegacyPlaintext: true,
              })
            )
          )
          return
        }

        let parsedData = record.json
        if (record.type === ShareTypeEnum.JSON && record.json) {
          try {
            parsedData = JSON.parse(record.json)
          } catch {
            parsedData = record.json
          }
        }

        res.json(
          withOwnerMeta(
            record,
            withPreviewOnly(record, {
              type: record.type,
              data: parsedData,
              json: record.json,
              slug: record.slug,
              isPrivate: record.isPrivate,
              accessType: record.accessType,
              mode: record.mode,
              schemaVersion: 1,
              isLegacyPlaintext: true,
            })
          )
        )
        return
      }

      res.json(
        withOwnerMeta(
          record,
          withPreviewOnly(record, {
            type: record.type,
            ciphertext: record.ciphertext,
            iv: record.iv,
            salt: record.salt,
            slug: record.slug,
            isPrivate: record.isPrivate,
            accessType: record.accessType,
            mode: record.mode,
            schemaVersion: record.schemaVersion ?? 2,
            isLegacyPlaintext: false,
          })
        )
      )
    } catch (error) {
      logger.error('API Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async unlockShare(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params
      const { password } = req.body

      const record = await shareService.getShareLink(slug as string)
      if (!record) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      const isLegacy =
        !record.schemaVersion ||
        record.schemaVersion === 1 ||
        (Boolean(record.json) && !record.ciphertext)

      if (isLegacy) {
        const isValid = shareService.verifyLegacyPassword(record, password)
        if (!isValid) {
          res.status(401).json({ error: 'Invalid password' })
          return
        }

        let parsedData = record.json
        if (record.type === ShareTypeEnum.JSON && record.json) {
          try {
            parsedData = JSON.parse(record.json)
          } catch {
            parsedData = record.json
          }
        }

        res.json(
          withOwnerMeta(
            record,
            withPreviewOnly(record, {
              type: record.type,
              data: parsedData,
              json: record.json,
              slug: record.slug,
              isPrivate: record.isPrivate,
              accessType: record.accessType,
              mode: record.mode,
              schemaVersion: 1,
              isLegacyPlaintext: true,
            })
          )
        )
        return
      }

      // If document is already E2EE (v2), unlocking happens client-side
      res.json(
        withOwnerMeta(
          record,
          withPreviewOnly(record, {
            type: record.type,
            ciphertext: record.ciphertext,
            iv: record.iv,
            salt: record.salt,
            slug: record.slug,
            isPrivate: record.isPrivate,
            accessType: record.accessType,
            mode: record.mode,
            schemaVersion: 2,
            isLegacyPlaintext: false,
          })
        )
      )
    } catch (error) {
      logger.error('Unlock error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async updateShare(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params
      const {
        schemaVersion,
        ciphertext,
        iv,
        salt,
        ownerKeyWrapped,
        mode,
        isPrivate,
        accessType,
        previewOnly,
        type,
      } = req.body

      const ownerId = req.auth?.userId

      const existing = await shareService.getShareLink(slug as string)
      if (existing) {
        if (existing.isPrivate && !isPrivate) {
          res
            .status(400)
            .json({ error: 'Cannot change a private link to public' })
          return
        }

        const nextPreviewOnly =
          previewOnly !== undefined
            ? previewOnly === true
            : existing.previewOnly === true

        const nextOwnerId = ownerId || existing.ownerId
        const canStoreOwnerWrap =
          isPrivate === true &&
          Boolean(nextOwnerId) &&
          ownerKeyWrapped !== undefined

        await shareService.updateShareLink(slug as string, {
          ownerId: nextOwnerId,
          schemaVersion: schemaVersion ?? 2,
          ciphertext,
          iv,
          salt: salt !== undefined ? salt : existing.salt,
          mode,
          isPrivate: isPrivate || false,
          accessType,
          previewOnly: nextPreviewOnly,
          type: type || ShareTypeEnum.JSON,
          ownerKeyWrapped: canStoreOwnerWrap
            ? ownerKeyWrapped
            : isPrivate === false
              ? null
              : undefined,
        })
        res.json({
          success: true,
          slug,
          schemaVersion: 2,
          ownerId: nextOwnerId,
          previewOnly: nextPreviewOnly,
        })
        return
      }

      const created = await shareService.createShareLink({
        slug: slug as string,
        ownerId,
        schemaVersion: schemaVersion ?? 2,
        ciphertext: ciphertext || '',
        iv: iv || '',
        salt,
        ownerKeyWrapped:
          isPrivate === true && ownerId && ownerKeyWrapped
            ? ownerKeyWrapped
            : undefined,
        mode: mode || ModeEnum.FORMATTER,
        isPrivate: isPrivate || false,
        accessType: accessType || AccessTypeEnum.EDITOR,
        previewOnly: previewOnly === true,
        type: type || ShareTypeEnum.JSON,
      })
      res.json({
        success: true,
        slug,
        created: true,
        schemaVersion: 2,
        ownerId: created.ownerId,
        previewOnly: created.previewOnly === true,
      })
    } catch (error) {
      logger.error('API Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async uploadShare(req: Request, res: Response): Promise<void> {
    try {
      const file = (req as MulterRequest).file

      if (!file) {
        res.status(400).json({ error: 'No file provided' })
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        res.status(413).json({ error: 'File size exceeds 2MB limit' })
        return
      }

      const text = file.buffer.toString('utf-8')

      try {
        JSON.parse(text)
      } catch {
        res.status(400).json({ error: 'Invalid JSON file' })
        return
      }

      const record = await shareService.createShareLink({
        schemaVersion: 1,
        json: text,
        mode: ModeEnum.VISUALIZE,
        isPrivate: false,
        accessType: AccessTypeEnum.VIEWER,
        type: ShareTypeEnum.JSON,
        previewOnly: false,
      })

      res.json(
        withOwnerMeta(
          record,
          withPreviewOnly(record, {
            slug: record.slug,
            schemaVersion: 1,
            isLegacyPlaintext: true,
            json: record.json,
            type: record.type,
            mode: record.mode,
            isPrivate: false,
            accessType: record.accessType,
          })
        )
      )
    } catch (error) {
      logger.error('Upload error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}
