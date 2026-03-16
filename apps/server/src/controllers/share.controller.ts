import { Request, Response } from 'express'
import { ShareService } from '../services/share.service'
import logger from '../config/logger'
import { ShareTypeEnum, ModeEnum, AccessTypeEnum } from '../enums/enum'

const shareService = new ShareService()

// Multer types from @types/multer
interface MulterRequest extends Request {
  file?: Express.Multer.File
}

export class ShareController {
  async createShare(req: Request, res: Response): Promise<void> {
    try {
      // All validation is handled by Joi middleware
      const { json, mode, isPrivate, accessType, password, type, slug } =
        req.body

      const record = await shareService.createShareLink({
        json: json || '',
        mode,
        isPrivate: isPrivate || false,
        accessType,
        password,
        type: type || ShareTypeEnum.JSON,
        slug,
      })

      res.json({
        slug: record.slug,
        mode: record.mode,
        type: record.type,
        isPrivate: record.isPrivate,
        accessType: record.accessType,
      })
    } catch (error) {
      logger.error('Error creating share link', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  async getRawShare(req: Request, res: Response): Promise<void> {
    try {
      // Validation handled by Joi middleware
      const { slug } = req.params
      const password = req.query.password as string | undefined

      const record = await shareService.getShareLink(slug as string)

      if (!record) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      // check password if private
      if (record.isPrivate) {
        if (!password) {
          res.status(401).json({ error: 'Password is required' })
          return
        }

        const isValid = shareService.verifyPassword(record, password)
        if (!isValid) {
          res.status(401).json({ error: 'Password is incorrect' })
          return
        }
      }

      res.json(
        record.type === ShareTypeEnum.JSON
          ? JSON.parse(record.json)
          : record.json
      )
    } catch (error) {
      logger.error('API Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async getShareMetaData(req: Request, res: Response): Promise<void> {
    try {
      // Validation handled by Joi middleware
      const { slug } = req.params

      const record = await shareService.getShareLink(slug as string)

      if (!record) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      if (record.isPrivate) {
        res.json({
          data: null,
          type: record.type,
          slug: record.slug,
          isPrivate: true,
          accessType: record.accessType,
          mode: record.mode,
        })
        return
      }

      res.json({
        type: record.type,
        data:
          record.type === ShareTypeEnum.JSON
            ? JSON.parse(record.json)
            : record.json,
        slug: record.slug,
        isPrivate: record.isPrivate,
        accessType: record.accessType,
        mode: record.mode,
      })
    } catch (error) {
      logger.error('API Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async unlockShare(req: Request, res: Response): Promise<void> {
    try {
      // Validation handled by Joi middleware
      const { slug } = req.params
      const { password } = req.body

      const record = await shareService.getShareLink(slug as string)
      if (!record) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      const isValid = shareService.verifyPassword(record, password)
      if (!isValid) {
        res.status(401).json({ error: 'Invalid password' })
        return
      }

      res.json({
        type: record.type,
        data:
          record.type === ShareTypeEnum.JSON
            ? JSON.parse(record.json)
            : record.json,
        slug: record.slug,
        isPrivate: record.isPrivate,
        accessType: record.accessType,
        mode: record.mode,
      })
    } catch (error) {
      logger.error('Unknown error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  async updateShare(req: Request, res: Response): Promise<void> {
    try {
      // Validation handled by Joi middleware
      const { slug } = req.params
      const { json, mode, isPrivate, accessType, password, type } = req.body

      const existing = await shareService.getShareLink(slug as string)
      if (existing) {
        // Business logic validation
        if (existing.isPrivate && !isPrivate) {
          res
            .status(400)
            .json({ error: 'Cannot change a private link to public' })
          return
        }

        await shareService.updateShareLink(slug as string, {
          json: json || '',
          mode,
          isPrivate: isPrivate || false,
          accessType,
          password,
          type: type || ShareTypeEnum.JSON,
        })
        res.json({ success: true, slug })
        return
      }

      // Upsert / Create if not exists (fallback)
      await shareService.createShareLink({
        slug: slug as string,
        json: json || '',
        mode,
        isPrivate: isPrivate || false,
        accessType: accessType || AccessTypeEnum.EDITOR,
        password,
        type: type || ShareTypeEnum.JSON,
      })
      res.json({ success: true, slug, created: true })
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

      // size check handled by multer limits, but safe double check
      if (file.size > 2 * 1024 * 1024) {
        res.status(413).json({ error: 'File size exceeds 2MB limit' })
        return
      }

      const text = file.buffer.toString('utf-8')

      const isMarkdown =
        file.originalname?.toLowerCase().endsWith('.md') ||
        file.originalname?.toLowerCase().endsWith('.mdx') ||
        file.mimetype === 'text/markdown'

      // Validate JSON only if it's not a markdown file
      if (!isMarkdown) {
        try {
          JSON.parse(text)
        } catch {
          res.status(400).json({ error: 'Invalid JSON file' })
          return
        }
      }

      const record = await shareService.createShareLink({
        json: text,
        mode: ModeEnum.VISUALIZE, // Default or could be inferred
        isPrivate: false,
        accessType: AccessTypeEnum.EDITOR,
        type: isMarkdown ? ShareTypeEnum.MARKDOWN : ShareTypeEnum.JSON,
      })

      res.json({ slug: record.slug })
    } catch (error) {
      console.error('Upload API Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}
