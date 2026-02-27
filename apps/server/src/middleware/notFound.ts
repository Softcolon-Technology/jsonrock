import { Request, Response } from 'express'

/**
 * 404 Not Found handler
 * This catches all requests that don't match any routes
 */

const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  })
}

export default notFoundHandler
