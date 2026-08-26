import Joi from 'joi'
import { AccessTypeEnum, ModeEnum, ShareTypeEnum } from '../enums/enum'

// Common reusable schemas
const slugSchema = Joi.string().max(20).required().messages({
  'string.max': 'Slug must not exceed 20 characters',
})

const modeSchema = Joi.string().when('type', {
  is: ShareTypeEnum.JSON,
  then: Joi.valid(...Object.values(ModeEnum))
    .required()
    .messages({
      'any.only': 'Mode must be one of: visualize, tree, formatter',
    }),
  otherwise: Joi.optional().allow(null, ''),
})

const typeSchema = Joi.string()
  .valid(...Object.values(ShareTypeEnum))
  .default(ShareTypeEnum.JSON)
  .messages({
    'any.only': 'Type must be either json or text',
  })

const accessTypeSchema = Joi.string()
  .valid(...Object.values(AccessTypeEnum))
  .default(AccessTypeEnum.VIEWER)
  .messages({
    'any.only': 'Access type must be either editor or viewer',
  })

// Validation schema for POST /api/share (create share)
export const createShareSchema = {
  body: Joi.object({
    schemaVersion: Joi.number().optional(),
    json: Joi.string().allow('').optional(),
    ciphertext: Joi.string().allow('').optional(),
    iv: Joi.string().allow('').optional(),
    salt: Joi.string().allow('', null).optional(),
    ownerKeyWrapped: Joi.string().allow('', null).optional(),
    mode: modeSchema,
    isPrivate: Joi.boolean().default(false),
    accessType: accessTypeSchema,
    previewOnly: Joi.boolean().default(false),
    type: typeSchema,
    slug: Joi.string().max(20).optional(),
  }),
}

// Validation schema for GET /api/share/:slug (get metadata & ciphertext)
export const getShareMetaSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
}

// Validation schema for POST /api/share/:slug (legacy password unlock)
export const unlockShareSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
  body: Joi.object({
    password: Joi.string().required().messages({
      'any.required': 'Password is required to unlock this share',
    }),
  }),
}

// Validation schema for PUT /api/share/:slug (update share)
export const updateShareSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
  body: Joi.object({
    schemaVersion: Joi.number().optional(),
    json: Joi.string().allow('').optional(),
    ciphertext: Joi.string().allow('').optional(),
    iv: Joi.string().allow('').optional(),
    salt: Joi.string().allow('', null).optional(),
    ownerKeyWrapped: Joi.string().allow('', null).optional(),
    mode: modeSchema,
    isPrivate: Joi.boolean().default(false),
    accessType: accessTypeSchema,
    previewOnly: Joi.boolean().optional(),
    type: typeSchema,
  }),
}

// Validation schema for POST /api/share/email
export const shareEmailSchema = {
  body: Joi.object({
    recipientEmail: Joi.string().email().required().messages({
      'string.email': 'A valid recipient email address is required',
      'any.required': 'Recipient email is required',
    }),
    shareUrl: Joi.string()
      .pattern(/^https?:\/\/\S+$/i)
      .required()
      .messages({
        'string.pattern.base': 'A valid share URL is required',
        'any.required': 'Share URL is required',
      }),
    documentTitle: Joi.string().max(200).allow('').default('Untitled document'),
  }),
}

// Validation schema for GET /api/share/:slug/owner-unlock
export const ownerUnlockSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
}

// Validation schema for GET /api/:slug (get raw share data)
export const getRawShareSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
}
