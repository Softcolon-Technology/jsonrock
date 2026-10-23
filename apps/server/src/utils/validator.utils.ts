import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import logger from '../config/logger'

interface ValidationSchema {
  body?: Joi.ObjectSchema
  params?: Joi.ObjectSchema
  query?: Joi.ObjectSchema
}

/**
 * Express 5 exposes `req.query` / `req.params` as getter-only. Reassigning
 * throws ("Cannot set property query … which has only a getter"), which made
 * every validated GET (e.g. /api/labels) return 500. Prefer defineProperty.
 */
function setValidated(
  req: Request,
  key: 'body' | 'params' | 'query',
  value: unknown
): void {
  try {
    // Express 4 allows direct assignment; Express 5 query/params are getters.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(req as any)[key] = value
  } catch {
    Object.defineProperty(req, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    })
  }
}

/**
 * Validation middleware factory
 * Validates request body, params, and query against provided Joi schemas
 */
export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = []

    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      })

      if (error) {
        errors.push(...error.details.map((detail) => `Body: ${detail.message}`))
      } else {
        setValidated(req, 'body', value)
      }
    }

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
        setValidated(req, 'params', value)
      }
    }

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
        setValidated(req, 'query', value)
      }
    }

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
