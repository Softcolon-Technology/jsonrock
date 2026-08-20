import { Request, Response } from 'express'
import { ShareService } from '../services/share.service'
import logger from '../config/logger'
import { ShareTypeEnum, ModeEnum, AccessTypeEnum } from '../enums/enum'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'

const shareService = new ShareService()

// Multer types from @types/multer
interface MulterRequest extends Request {
  file?: Express.Multer.File
}

export class ShareController {
  async createShare(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        schemaVersion,
        ciphertext,
        iv,
        salt,
        mode,
        isPrivate,
        accessType,
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
        mode: mode || ModeEnum.FORMATTER,
        isPrivate: isPrivate || false,
        accessType: accessType || AccessTypeEnum.VIEWER,
        type: type || ShareTypeEnum.JSON,
        slug,
      })

      res.json({
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
    } catch (error) {
      logger.error('Error creating share link', error)
      res.status(500).json({ error: 'Internal server error' })
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

        res.json({
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
        return
      }

      res.json({
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
          res.json({
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

        res.json({
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
        return
      }

      res.json({
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

        res.json({
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
        return
      }

      // If document is already E2EE (v2), unlocking happens client-side
      res.json({
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
        mode,
        isPrivate,
        accessType,
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

        await shareService.updateShareLink(slug as string, {
          ownerId: ownerId || existing.ownerId,
          schemaVersion: schemaVersion ?? 2,
          ciphertext,
          iv,
          salt: salt !== undefined ? salt : existing.salt,
          mode,
          isPrivate: isPrivate || false,
          accessType,
          type: type || ShareTypeEnum.JSON,
        })
        res.json({
          success: true,
          slug,
          schemaVersion: 2,
          ownerId: ownerId || existing.ownerId,
        })
        return
      }

      // Upsert / Create if not exists (fallback)
      const created = await shareService.createShareLink({
        slug: slug as string,
        ownerId,
        schemaVersion: schemaVersion ?? 2,
        ciphertext: ciphertext || '',
        iv: iv || '',
        salt,
        mode: mode || ModeEnum.FORMATTER,
        isPrivate: isPrivate || false,
        accessType: accessType || AccessTypeEnum.EDITOR,
        type: type || ShareTypeEnum.JSON,
      })
      res.json({
        success: true,
        slug,
        created: true,
        schemaVersion: 2,
        ownerId: created.ownerId,
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

      const isMarkdown =
        file.originalname?.toLowerCase().endsWith('.md') ||
        file.originalname?.toLowerCase().endsWith('.mdx') ||
        file.mimetype === 'text/markdown'

      const uploadType = isMarkdown
        ? ShareTypeEnum.MARKDOWN
        : ShareTypeEnum.JSON

      const record = await shareService.createShareLink({
        schemaVersion: 2,
        ciphertext: text,
        iv: '',
        mode: ModeEnum.VISUALIZE,
        isPrivate: false,
        accessType: AccessTypeEnum.EDITOR,
        type: uploadType,
      })

      res.json({ slug: record.slug, schemaVersion: 2 })
    } catch (error) {
      console.error('Upload API Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}
