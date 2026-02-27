import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger'

// Custom error classes
export class AppError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

// Global error handler middleware
// Must have all 4 parameters for Express to recognize it as error handler
const globalErrorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by Express error handler signature
  _next: NextFunction
): void => {
  // Default error values
  let statusCode = 500
  let message = 'Internal Server Error'
  let isOperational = false

  // Check if it's our custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode
    message = err.message
    isOperational = err.isOperational
  } else if ('statusCode' in err && typeof err.statusCode === 'number') {
    // Handle other errors with statusCode property
    statusCode = err.statusCode
    message = err.message || message
  }

  // Log error with context
  const errorLog = {
    message: err.message,
    stack: err.stack,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    isOperational,
  }

  // Log based on severity
  if (statusCode >= 500) {
    logger.error('Server Error', errorLog)
  } else if (statusCode >= 400) {
    logger.warn('Client Error', errorLog)
  } else {
    logger.info('Request Error', errorLog)
  }

  // Send error response
  const errorResponse: {
    success: false
    error: string
    statusCode: number
    stack?: string
  } = {
    success: false,
    error: message,
    statusCode,
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack
  }

  res.status(statusCode).json(errorResponse)
}

export default globalErrorHandler
