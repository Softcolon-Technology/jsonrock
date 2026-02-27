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
    json: Joi.string().allow('').optional(),
    mode: modeSchema,
    isPrivate: Joi.boolean().default(false),
    accessType: accessTypeSchema,
    password: Joi.string()
      .min(4)
      .when('isPrivate', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        'string.min': 'Password must be at least 4 characters',
        'any.required': 'Password is required for private links',
      }),
    type: typeSchema,
    slug: Joi.string().max(20).optional(),
  }),
}

// Validation schema for GET /api/share/:slug (get metadata)
export const getShareMetaSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
}

// Validation schema for POST /api/share/:slug (unlock private share)
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
    json: Joi.string().allow('').optional(),
    mode: modeSchema,
    isPrivate: Joi.boolean().default(false),
    accessType: accessTypeSchema,
    password: Joi.string()
      .min(4)
      .when('isPrivate', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null, ''),
      })
      .messages({
        'string.min': 'Password must be at least 4 characters',
        'any.required': 'Password is required for private links',
      }),
    type: typeSchema,
  }),
}

// Validation schema for GET /api/:slug (get raw share data)
export const getRawShareSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
  query: Joi.object({
    password: Joi.string().optional(),
  }),
}
