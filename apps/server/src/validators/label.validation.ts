import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const listLabelsSchema = {
  query: Joi.object({
    projectId: objectId.optional().allow('', null),
  }),
}

export const createLabelSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(40).required(),
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .messages({ 'string.pattern.base': 'color must be a hex like #3b82f6' }),
    projectId: objectId.optional().allow(null),
  }),
}

export const deleteLabelSchema = {
  params: Joi.object({
    id: objectId.required(),
  }),
}

export const setFileLabelsSchema = {
  params: Joi.object({
    slug: Joi.string().trim().min(1).max(20).required(),
  }),
  body: Joi.object({
    labelIds: Joi.array().items(objectId).max(20).required(),
  }),
}
