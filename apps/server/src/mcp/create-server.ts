import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { McpAuthContext } from '../services/mcp-token.service'
import { McpShareError, McpShareService } from '../services/mcp-share.service'
import { getSiteUrl, parseShareReference } from './urls'
import { JSON_ROCK_ICON_DATA_URI } from './icon'
import logger from '../config/logger'

const tools = new McpShareService()

const typeSchema = z
  .enum(['json', 'text', 'markdown', 'html'])
  .describe(
    'json = visualizer/formatter, text = rich text, markdown = Markdown + Mermaid, html = HTML preview'
  )

const modeSchema = z
  .enum(['formatter', 'visualize', 'tree'])
  .optional()
  .describe('JSON view only. Default formatter.')

const accessSchema = z
  .enum(['viewer', 'editor'])
  .optional()
  .describe('Link access. Default editor (agents can write back).')

const titleSchema = z
  .string()
  .max(60)
  .optional()
  .describe('Library display title (max 60). Defaults to Untitled … by type.')

const projectIdRequired = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-char hex project id')
  .describe('Project id from list_projects or create_project')

const projectIdOptional = projectIdRequired
  .optional()
  .describe(
    'Optional project id. Omit for a normal standalone Library file; set to create inside a project.'
  )

const labelsSchema = z
  .array(z.string().min(1).max(40))
  .max(20)
  .optional()
  .describe(
    'Label names or ids (from list_labels). Defaults include feature, bug, documentation. Multiple allowed.'
  )

function toolError(error: unknown) {
  const message =
    error instanceof McpShareError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Something went wrong'
  if (!(error instanceof McpShareError)) {
    logger.error('MCP tool failed', error)
  }
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  }
}

function toolText(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

function referenceFrom(input: { slug?: string; url?: string }): {
  slug: string
  key?: string
} {
  if (input.url?.trim()) return parseShareReference(input.url)
  if (input.slug?.trim()) return parseShareReference(input.slug)
  throw new McpShareError('Pass a slug or a full file URL.')
}

const slugOrUrl = {
  slug: z.string().max(20).optional().describe('File id (slug)'),
  url: z
    .string()
    .max(2000)
    .optional()
    .describe('Full editor URL, including #key= when public'),
}

export function createJsonRockMcpServer(auth: McpAuthContext): McpServer {
  const siteUrl = getSiteUrl()
  const server = new McpServer(
    {
      name: 'jsonrock',
      title: 'JSON Rock',
      version: '1.3.0',
      description:
        'JsonRock Library & Projects: create/list projects, create/list/read/write encrypted files (JSON, text, Markdown, HTML), and assign multi-labels (feature, bug, documentation, or custom).',
      websiteUrl: siteUrl,
      icons: [
        {
          src: JSON_ROCK_ICON_DATA_URI,
          mimeType: 'image/svg+xml',
          sizes: ['any'],
        },
        {
          src: `${siteUrl}/icon.svg`,
          mimeType: 'image/svg+xml',
          sizes: ['any'],
        },
      ],
    },
    {
      instructions: [
        'JsonRock Library workflow for agents:',
        '1) list_projects or create_project',
        '2) create_file without project_id = standalone; with project_id = inside that project',
        '3) list_files (optional project_id / labels) or get_project to see files',
        '4) read_file to decrypt; write_file to change content',
        '5) Labels: list_labels (defaults docs/feature/bug/general); create_label for custom (owner); set_file_labels or create_file.labels to assign (multi-label). Personal vs project catalogs are separate.',
        'Always keep the full returned URL including #key= for public files.',
        'Optional password on create_file makes a private file.',
        'Files expire 30 days after creation.',
      ].join(' '),
    }
  )

  /* ---------------------------- projects ---------------------------- */

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'List Workspace projects (id, name, role, file/member counts). Use an id with create_file.project_id or get_project.',
      annotations: { title: 'List projects', readOnlyHint: true },
    },
    async () => {
      try {
        return toolText(await tools.listProjects(auth.userId))
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description:
        'Create an empty project. Returns project id — pass it to create_file as project_id.',
      inputSchema: {
        name: z.string().min(1).max(80).describe('Project display name'),
      },
      annotations: {
        title: 'Create project',
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        return toolText(await tools.createProject(auth.userId, args.name))
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'get_project',
    {
      title: 'Get project (list its files)',
      description:
        'Show one project and list the files in it (titles + slugs). Does not return file bodies — use read_file for that.',
      inputSchema: {
        project_id: projectIdRequired,
      },
      annotations: { title: 'Get project', readOnlyHint: true },
    },
    async (args) => {
      try {
        return toolText(await tools.getProject(auth.userId, args.project_id))
      } catch (error) {
        return toolError(error)
      }
    }
  )

  /* ------------------------------ files ----------------------------- */

  server.registerTool(
    'list_files',
    {
      title: 'List files',
      description:
        'List Library files. Omit project_id for the whole library (standalone + projects). Pass project_id to list only that project’s files. Optional labels filter (names or ids; file must have at least one).',
      inputSchema: {
        project_id: projectIdOptional,
        labels: labelsSchema,
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Max files when listing the whole library. Default 20.'),
      },
      annotations: { title: 'List files', readOnlyHint: true },
    },
    async (args) => {
      try {
        return toolText(
          await tools.listFiles(auth.userId, {
            projectId: args.project_id,
            limit: args.limit ?? 20,
            labelRefs: args.labels,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'create_file',
    {
      title: 'Create file',
      description:
        'Create a new encrypted file in the Library. Omit project_id for a normal standalone file. Pass project_id to create the file inside a project. Optional labels (names/ids from list_labels). Returns a shareable URL — keep the #key= fragment.',
      inputSchema: {
        content: z
          .string()
          .min(1)
          .max(1_500_000)
          .describe('File body to store'),
        type: typeSchema,
        title: titleSchema,
        project_id: projectIdOptional,
        labels: labelsSchema,
        mode: modeSchema,
        access: accessSchema,
        preview_only: z
          .boolean()
          .optional()
          .describe(
            'Markdown only: non-owners see a read-only preview when true.'
          ),
        password: z
          .string()
          .min(4)
          .max(128)
          .optional()
          .describe('Optional. Makes the file private (min 4 characters).'),
      },
      annotations: {
        title: 'Create file',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        return toolText(
          await tools.createShare(auth.userId, {
            content: args.content,
            type: args.type,
            title: args.title,
            projectId: args.project_id,
            labels: args.labels,
            mode: args.mode,
            access: args.access,
            previewOnly: args.preview_only,
            password: args.password,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'read_file',
    {
      title: 'Read file',
      description:
        'Decrypt and return a file’s content. Pass slug or the full URL (with #key= for public files). Private files need password when the key cannot be restored for this account.',
      inputSchema: {
        ...slugOrUrl,
        password: z.string().min(4).max(128).optional(),
      },
      annotations: {
        title: 'Read file',
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const ref = referenceFrom(args)
        return toolText(
          await tools.readShare(auth.userId, {
            slug: ref.slug,
            key: ref.key,
            password: args.password,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'write_file',
    {
      title: 'Write file (change content)',
      description:
        'Replace the content of an existing file this account can edit. Pass slug or full URL. Optionally also rename (title) or move (project_id; null = standalone). For public browser-created files, pass the full URL with #key= when writing content.',
      inputSchema: {
        content: z.string().min(1).max(1_500_000).describe('New file body'),
        ...slugOrUrl,
        title: titleSchema,
        project_id: z
          .union([
            z
              .string()
              .regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-char hex project id'),
            z.null(),
          ])
          .optional()
          .describe(
            'Optional. Move into this project, or null to make standalone.'
          ),
        password: z
          .string()
          .min(4)
          .max(128)
          .optional()
          .describe(
            'Required for private files when the key cannot be restored.'
          ),
      },
      annotations: {
        title: 'Write file',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const ref = referenceFrom(args)
        return toolText(
          await tools.updateShare(auth.userId, {
            slug: ref.slug,
            key: ref.key,
            content: args.content,
            title: args.title,
            projectId: args.project_id,
            password: args.password,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  /* ----------------------------- labels ----------------------------- */

  server.registerTool(
    'list_labels',
    {
      title: 'List labels',
      description:
        'List the label catalog. Omit project_id for personal (standalone) labels; pass project_id for that project’s catalog. Seeds defaults: feature, bug, documentation.',
      inputSchema: {
        project_id: projectIdOptional,
      },
      annotations: { title: 'List labels', readOnlyHint: true },
    },
    async (args) => {
      try {
        return toolText(
          await tools.listLabels(auth.userId, args.project_id ?? null)
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'create_label',
    {
      title: 'Create label',
      description:
        'Create a custom label. Personal catalog when project_id is omitted; project catalog requires project owner. Defaults (feature/bug/documentation) already exist.',
      inputSchema: {
        name: z
          .string()
          .min(1)
          .max(40)
          .describe('Label name (unique within the catalog)'),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional()
          .describe('Optional hex color, e.g. #00B3B7'),
        project_id: projectIdOptional,
      },
      annotations: {
        title: 'Create label',
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        return toolText(
          await tools.createLabel(auth.userId, {
            name: args.name,
            color: args.color,
            projectId: args.project_id ?? null,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'set_file_labels',
    {
      title: 'Set file labels',
      description:
        'Replace all labels on a file (multi-assign). Pass label names or ids from list_labels for the file’s scope (personal vs project). Empty array clears labels. Editors/owners only.',
      inputSchema: {
        ...slugOrUrl,
        labels: z
          .array(z.string().min(1).max(40))
          .max(20)
          .describe(
            'Full set of label names or ids to assign. Empty = clear all.'
          ),
      },
      annotations: {
        title: 'Set file labels',
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const ref = referenceFrom(args)
        return toolText(
          await tools.setFileLabels(auth.userId, {
            slug: ref.slug,
            labels: args.labels,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  /* -------- legacy share aliases (same behavior, older names) -------- */

  server.registerTool(
    'create_share',
    {
      title: 'Create file (alias)',
      description:
        'Alias of create_file. Prefer create_file. Publish content and return a link; optional title, project_id, and labels.',
      inputSchema: {
        content: z.string().min(1).max(1_500_000),
        type: typeSchema,
        title: titleSchema,
        project_id: projectIdOptional,
        labels: labelsSchema,
        mode: modeSchema,
        access: accessSchema,
        preview_only: z.boolean().optional(),
        password: z.string().min(4).max(128).optional(),
      },
      annotations: {
        title: 'Create share link',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        return toolText(
          await tools.createShare(auth.userId, {
            content: args.content,
            type: args.type,
            title: args.title,
            projectId: args.project_id,
            labels: args.labels,
            mode: args.mode,
            access: args.access,
            previewOnly: args.preview_only,
            password: args.password,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'update_share',
    {
      title: 'Write file (alias)',
      description:
        'Alias of write_file. Prefer write_file. content is optional when only renaming or moving.',
      inputSchema: {
        content: z.string().min(1).max(1_500_000).optional(),
        title: titleSchema,
        project_id: z
          .union([
            z
              .string()
              .regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-char hex project id'),
            z.null(),
          ])
          .optional(),
        ...slugOrUrl,
        password: z.string().min(4).max(128).optional(),
      },
      annotations: {
        title: 'Update share',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const ref = referenceFrom(args)
        return toolText(
          await tools.updateShare(auth.userId, {
            slug: ref.slug,
            key: ref.key,
            content: args.content,
            title: args.title,
            projectId: args.project_id,
            password: args.password,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'read_share',
    {
      title: 'Read file (alias)',
      description: 'Alias of read_file. Prefer read_file.',
      inputSchema: {
        ...slugOrUrl,
        password: z.string().min(4).max(128).optional(),
      },
      annotations: { title: 'Read share', readOnlyHint: true },
    },
    async (args) => {
      try {
        const ref = referenceFrom(args)
        return toolText(
          await tools.readShare(auth.userId, {
            slug: ref.slug,
            key: ref.key,
            password: args.password,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'list_shares',
    {
      title: 'List files (alias)',
      description: 'Alias of list_files. Prefer list_files.',
      inputSchema: {
        project_id: projectIdOptional,
        labels: labelsSchema,
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { title: 'List shares', readOnlyHint: true },
    },
    async (args) => {
      try {
        return toolText(
          await tools.listFiles(auth.userId, {
            projectId: args.project_id,
            labelRefs: args.labels,
            limit: args.limit ?? 20,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'change_share_access',
    {
      title: 'Change link access',
      description:
        'Change viewer vs editor on the share link for a file owned by this account. Does not change content.',
      inputSchema: {
        ...slugOrUrl,
        access: z.enum(['viewer', 'editor']),
      },
      annotations: {
        title: 'Change share access',
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const ref = referenceFrom(args)
        return toolText(
          await tools.changeShareAccess(auth.userId, {
            slug: ref.slug,
            key: ref.key,
            access: args.access,
          })
        )
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'whoami',
    {
      title: 'Check MCP token',
      description:
        'Confirm the MCP token is valid. Does not return the token secret.',
      annotations: { title: 'Who am I', readOnlyHint: true },
    },
    async () =>
      toolText(
        [
          `Authenticated with MCP token "${auth.tokenName}".`,
          'Tools: list_projects, create_project, get_project, list_files, create_file, read_file, write_file, list_labels, create_label, set_file_labels.',
        ].join(' ')
      )
  )

  return server
}
