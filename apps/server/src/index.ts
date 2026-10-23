import express, { type Request, type Response } from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { connectDB } from './db/conn'
import shareRoutes from './routes/share.routes'
import webhookRoutes from './routes/webhook.routes'
import mcpTokenRoutes from './routes/mcp-token.routes'
import filesRoutes from './routes/files.routes'
import projectRoutes from './routes/project.routes'
import labelRoutes, { fileLabelsRouter } from './routes/label.routes'
import { verifyToken } from '@clerk/backend'
import { setIo, userRoom } from './lib/socket-registry'
import { createMcpRouter } from './mcp/http'
import morgan from 'morgan'
import logger from './config/logger'
import globalErrorHandler from './middleware/errorLogger'
import notFoundHandler from './middleware/notFound'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3005

// Next.js `/api` rewrites (and production reverse proxies) set X-Forwarded-For.
// Trust one hop so express-rate-limit keys by the real client IP instead of
// logging ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
// https://express-rate-limit.github.io/ERR_ERL_UNEXPECTED_X_FORWARDED_FOR/
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS)
app.set(
  'trust proxy',
  Number.isFinite(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1
)

app.use(cors())

// Webhook routes mounted BEFORE global express.json() to preserve raw body for Svix signature verification
app.use('/api/webhooks', webhookRoutes)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

app.use(morgan('dev'))

// Routes. MCP token routes are mounted before the share router so /api/mcp
// is not captured by the share slug handler.
app.use('/api/mcp', mcpTokenRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/files', fileLabelsRouter)
app.use('/api/labels', labelRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api', shareRoutes)
app.use('/mcp', createMcpRouter())

connectDB()

const io = new Server(httpServer, {
  path: '/api/socket/io',
  addTrailingSlash: false,
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

setIo(io)

/** Verify a Clerk session JWT and return the Clerk user id (or null). */
async function verifySocketToken(token: unknown): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey || typeof token !== 'string' || !token) return null
  try {
    const verified = await verifyToken(token, { secretKey })
    return verified?.sub ?? null
  } catch (error) {
    logger.warn('Socket Clerk token verification failed', error)
    return null
  }
}

// CRITICAL FIX #1: Add Rate Limiter to prevent spam
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_POINTS = 10 // 10 messages per second
const RATE_LIMIT_DURATION = 1000 // 1 second

function checkRateLimit(socketId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(socketId)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(socketId, {
      count: 1,
      resetTime: now + RATE_LIMIT_DURATION,
    })
    return true
  }

  if (entry.count >= RATE_LIMIT_POINTS) {
    return false // Rate limit exceeded
  }

  entry.count++
  return true
}

// // CRITICAL FIX #2: Cleanup rate limit map to prevent memory leak
// setInterval(() => {
//   const now = Date.now()
//   for (const [socketId, entry] of rateLimitMap.entries()) {
//     if (now > entry.resetTime) {
//       rateLimitMap.delete(socketId)
//     }
//   }
// }, 60000) // Cleanup every minute

io.on('connection', (socket) => {
  // console.log("New client connected", socket.id);

  // Authenticated private room (`user:{clerkUserId}`) for project invites.
  // Client emits: socket.emit('auth/join', room, { token }). The room is derived
  // from the verified token, never trusted from the client.
  socket.on('auth/join', async (...args: unknown[]) => {
    if (!checkRateLimit(socket.id)) return
    const payload = args.find(
      (a): a is { token?: unknown } => typeof a === 'object' && a !== null
    )
    const token =
      payload?.token ??
      (socket.handshake.auth as { token?: unknown } | undefined)?.token
    const userId = await verifySocketToken(token)
    if (!userId) {
      socket.emit('auth/error', { message: 'Invalid or missing auth token' })
      return
    }
    socket.join(userRoom(userId))
    socket.emit('auth/joined', { room: userRoom(userId) })
  })

  socket.on('join-room', (slug: string) => {
    // Private user rooms can only be joined through the verified auth/join event.
    if (typeof slug !== 'string' || slug.startsWith('user:')) return
    socket.join(slug)
    // console.log(`Client ${socket.id} joined room ${slug}`);
  })

  socket.on('code-change', (data: { slug: string; newCode: string }) => {
    // CRITICAL FIX #3: Add rate limiting to code-change events
    if (!checkRateLimit(socket.id)) {
      // console.log(`Rate limit exceeded for ${socket.id}`);
      socket.emit('error', { message: 'Too many updates. Please slow down.' })
      return
    }

    // Broadcast to everyone ELSE in the room
    socket.to(data.slug).emit('code-change', data.newCode)
  })

  socket.on('leave-room', (slug: string) => {
    socket.leave(slug)
    // console.log(`Client ${socket.id} left room ${slug}`);
  })

  socket.on('disconnect', () => {
    // CRITICAL FIX #4: Cleanup rate limit entry on disconnect
    rateLimitMap.delete(socket.id)
    // console.log("Client disconnected", socket.id);
  })
})

app.get('/', (req: Request, res: Response) => {
  res.send('JSON Rock Backend is running!')
})

// 404 handler
app.use(notFoundHandler)

// Global error handler
app.use(globalErrorHandler)

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise Rejection', {
    reason,
  })
})

httpServer.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`)
})
