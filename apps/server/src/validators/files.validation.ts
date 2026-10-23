import Joi from 'joi'

const slugSchema = Joi.string().max(20).required().messages({
  'any.required': 'Slug is required',
  'string.max': 'Slug must not exceed 20 characters',
})

/** GET /api/files/:slug */
export const getFileMetaSchema = {
  params: Joi.object({
    slug: slugSchema,
  }),
}
