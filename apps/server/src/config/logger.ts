import winston from 'winston'
import path from 'path'

const logDir = 'logs'

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

const logger: winston.Logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: {
    service: 'backend-service',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),

    // ALL LOGS
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
})

/**
 * Console logging only for non-production
 * Use simple format without timestamp/metadata for clean console output
 */
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => `${level}: ${message}`)
      ),
    })
  )
}

export default logger
