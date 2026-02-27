import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import logger from '../config/logger'

interface ValidationSchema {
  body?: Joi.ObjectSchema
  params?: Joi.ObjectSchema
  query?: Joi.ObjectSchema
}

/**
 * Validation middleware factory
 * Validates request body, params, and query against provided Joi schemas
 */
export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = []

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      })

      if (error) {
        errors.push(...error.details.map((detail) => `Body: ${detail.message}`))
      } else {
        req.body = value
      }
    }

    // Validate params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      })

      if (error) {
        errors.push(
          ...error.details.map((detail) => `Params: ${detail.message}`)
        )
      } else {
        req.params = value
      }
    }

    // Validate query
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      })

      if (error) {
        errors.push(
          ...error.details.map((detail) => `Query: ${detail.message}`)
        )
      } else {
        req.query = value
      }
    }

    // If there are validation errors, return 400
    if (errors.length > 0) {
      logger.warn('Validation failed', {
        errors,
        path: req.path,
        method: req.method,
      })

      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      })
      return
    }

    next()
  }
}
