import { createHash } from 'crypto'
import { Request, Response, Router } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import logger from '../config/logger'
import { McpTokenService } from '../services/mcp-token.service'
import { createJsonRockMcpServer } from './create-server'

const mcpTokenService = new McpTokenService()

export function extractMcpToken(req: Request): string | null {
  const authorization = req.headers.authorization
  if (authorization?.startsWith('Bearer ')) {
    const value = authorization.slice('Bearer '.length).trim()
    if (value.startsWith('jr_mcp_')) return value
  }

  const header = req.headers['x-jsonrock-token']
  if (typeof header === 'string' && header.trim().startsWith('jr_mcp_')) {
    return header.trim()
  }
  return null
}

function unauthorized(res: Response, message: string, invalid = false): void {
  const challenge = invalid
    ? 'Bearer realm="jsonrock", error="invalid_token"'
    : 'Bearer realm="jsonrock"'
  res.setHeader('WWW-Authenticate', challenge)
  res.status(401).json({ error: message })
}

function methodNotAllowed(res: Response): void {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  })
}

const mcpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = extractMcpToken(req)
    if (token) return createHash('sha256').update(token).digest('hex')
    return ipKeyGenerator(req.ip ?? '')
  },
  message: { error: 'Too many MCP requests. Please slow down.' },
})

export function createMcpRouter(): Router {
  const router = Router()
  router.use(mcpLimiter)

  router.get('/', (_req, res) => {
    methodNotAllowed(res)
  })
  router.delete('/', (_req, res) => {
    methodNotAllowed(res)
  })

  router.post('/', async (req, res) => {
    const secret = extractMcpToken(req)
    if (!secret) {
      unauthorized(
        res,
        'A JSON Rock MCP token is required. Create one while signed in at /workspace/mcp and send it as Authorization: Bearer jr_mcp_...'
      )
      return
    }

    try {
      const auth = await mcpTokenService.authenticate(secret)
      if (!auth) {
        unauthorized(res, 'Invalid or revoked MCP token.', true)
        return
      }

      const server = createJsonRockMcpServer(auth)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      logger.error('MCP request failed', error)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      }
    }
  })

  return router
}
