import Joi from 'joi'

const objectId = Joi.string().hex().length(24).required().messages({
  'string.length': 'Invalid id',
  'string.hex': 'Invalid id',
})

const inviteToken = Joi.string().min(8).max(128).required()

const projectName = Joi.string().trim().min(1).max(80).required().messages({
  'string.empty': 'Project name is required',
  'string.max': 'Project name must not exceed 80 characters',
})

export const projectIdParamsSchema = {
  params: Joi.object({ id: objectId }),
}

export const createProjectSchema = {
  body: Joi.object({ name: projectName }),
}

export const renameProjectSchema = {
  params: Joi.object({ id: objectId }),
  body: Joi.object({ name: projectName }),
}

export const createInviteSchema = {
  params: Joi.object({ id: objectId }),
  body: Joi.object({
    email: Joi.string()
      .trim()
      .email({ tlds: { allow: false } })
      .max(254)
      .required()
      .messages({
        'string.email': 'A valid email address is required',
        'any.required': 'Email is required',
      }),
    role: Joi.string().valid('editor', 'viewer').required(),
  }),
}

export const revokeInviteSchema = {
  params: Joi.object({ id: objectId, token: inviteToken }),
}

export const inviteTokenParamsSchema = {
  params: Joi.object({ token: inviteToken }),
}

export const memberParamsSchema = {
  params: Joi.object({
    id: objectId,
    userId: Joi.string().min(1).max(128).required(),
  }),
}

export const updateMemberSchema = {
  params: Joi.object({
    id: objectId,
    userId: Joi.string().min(1).max(128).required(),
  }),
  body: Joi.object({
    role: Joi.string().valid('owner', 'editor', 'viewer').required(),
  }),
}
