'use client'

import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  KeyRound,
  LockKeyhole,
  Plus,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  oneLight,
  vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism'
import { isProjectsEnabled } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'

const getIsDarkMode = () =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark')

interface McpToken {
  id: string
  name: string
  tokenPrefix: string
  createdAt: string
  lastUsedAt: string | null
  secret?: string
}

const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL ||
  `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3005'}/mcp`

function formatWhen(value: string | null): string {
  if (!value) return 'Never used'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function cursorConfig(token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        jsonrock: {
          url: MCP_URL,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2
  )
}

function claudeCodeCommand(token: string): string {
  return `claude mcp add --transport http --scope user jsonrock ${MCP_URL} \\\n  --header "Authorization: Bearer ${token}"`
}

export default function McpTokensPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { openSignIn } = useClerk()
  const { user } = useUser()
  const [tokens, setTokens] = useState<McpToken[]>([])
  const [name, setName] = useState('My AI agent')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freshSecret, setFreshSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [guide, setGuide] = useState<'cursor' | 'claude'>('cursor')

  const authHeaders = useCallback(async () => {
    const session = await getToken()
    if (!session) throw new Error('Sign in again to manage tokens.')
    return {
      Authorization: `Bearer ${session}`,
      'Content-Type': 'application/json',
    }
  }, [getToken])

  const loadTokens = useCallback(async () => {
    setError(null)
    const headers = await authHeaders()
    const res = await fetch('/api/mcp/tokens', { headers })
    const data = (await res.json()) as { tokens?: McpToken[]; error?: string }
    if (!res.ok) throw new Error(data.error || 'Could not load tokens')
    setTokens(data.tokens || [])
  }, [authHeaders])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    loadTokens()
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load tokens')
      })
      .finally(() => setLoading(false))
  }, [isLoaded, isSignedIn, loadTokens])

  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const createToken = async () => {
    setCreating(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: name.trim() || 'MCP token' }),
      })
      const data = (await res.json()) as { token?: McpToken; error?: string }
      if (!res.ok || !data.token?.secret) {
        throw new Error(data.error || 'Could not create token')
      }
      setFreshSecret(data.token.secret)
      setTokens((current) => [data.token as McpToken, ...current])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create token')
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    if (
      !window.confirm('Revoke this token? Agents using it will stop working.')
    ) {
      return
    }
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/mcp/tokens/${id}`, {
        method: 'DELETE',
        headers,
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not revoke token')
      setTokens((current) => current.filter((token) => token.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke token')
    }
  }

  const placeholder = 'jr_mcp_your_token'
  const samples = useMemo(() => {
    const token = freshSecret || placeholder
    return {
      cursor: cursorConfig(token),
      claude: claudeCodeCommand(token),
    }
  }, [freshSecret])

  return (
    <div
      className={`${isProjectsEnabled ? 'min-h-[calc(100vh-60px)]' : 'min-h-screen'} bg-[var(--jr-bg)] text-[var(--jr-text)]`}
    >
      {/* The workspace shell provides the top bar when projects are enabled. */}
      {!isProjectsEnabled && (
        <header className='sticky top-0 z-30 border-b border-[var(--jr-border)] bg-[var(--jr-surface)]/90 backdrop-blur-xl'>
          <div className='mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8'>
            <Link
              href='/'
              className='flex items-center gap-2.5 font-semibold tracking-tight'
            >
              <ArrowLeft size={17} className='text-[var(--jr-muted)]' />
              <span>JSON Rock</span>
            </Link>
            <div className='flex items-center gap-3 text-sm'>
              <span className='hidden text-[var(--jr-muted)] sm:inline'>
                Model Context Protocol
              </span>
              <Link
                href='/editor'
                className='cursor-pointer rounded-lg border border-[var(--jr-border)] bg-[var(--jr-surface)] px-3.5 py-2 font-medium text-[var(--jr-text)] transition hover:bg-[var(--jr-hover)]'
              >
                Open editor
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className='mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14'>
        <section className='relative overflow-hidden rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-6 py-10 sm:px-10 sm:py-12'>
          <div className='absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[var(--jr-accent-soft)] blur-3xl' />
          <div className='absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-[var(--jr-accent-soft)] blur-3xl opacity-70' />
          <div className='relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center'>
            <div className='max-w-3xl'>
              <div className='mb-5 flex items-center gap-3'>
                <div className='rounded-xl border border-[var(--jr-border)] bg-[var(--jr-bg)] p-2.5'>
                  <Image
                    src='/mcp.png'
                    alt='MCP'
                    width={34}
                    height={34}
                    className='h-[34px] w-[34px]'
                    priority
                  />
                </div>
                <span className='rounded-full border border-[var(--jr-accent)]/25 bg-[var(--jr-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--jr-accent-hover)]'>
                  MCP integration
                </span>
              </div>
              <h1 className='max-w-2xl text-3xl font-bold tracking-tight text-[var(--jr-text)] sm:text-5xl'>
                Give your AI agents a way to publish.
              </h1>
              <p className='mt-4 max-w-2xl text-base leading-7 text-[var(--jr-muted)] sm:text-lg'>
                Connect Cursor or Claude Code to JSON Rock. Your agent can turn
                JSON, text, Markdown with Mermaid, or HTML into one encrypted,
                shareable link.
              </p>
            </div>
            <div className='grid min-w-56 gap-3 text-sm text-[var(--jr-text-2)]'>
              <Feature
                icon={<ShieldCheck size={17} />}
                text='Encrypted content'
              />
              <Feature
                icon={<Sparkles size={17} />}
                text='Library · projects · labels'
              />
              <Feature icon={<Server size={17} />} text='Hosted HTTP server' />
            </div>
          </div>
        </section>

        <section className='mt-8 grid gap-3 sm:grid-cols-3'>
          <Step
            number='1'
            title='Create a token'
            text='Name it for the agent you use.'
          />
          <Step
            number='2'
            title='Add the server'
            text='Paste the config or run the command.'
          />
          <Step
            number='3'
            title='Ask your agent'
            text='“Publish this with JSON Rock.”'
          />
        </section>

        {!isLoaded || (isSignedIn && loading) ? (
          <div className='mt-8 rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-8 text-sm text-[var(--jr-muted)]'>
            Loading your MCP workspace…
          </div>
        ) : !isSignedIn ? (
          <section className='mt-8 rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-7'>
            <div className='flex max-w-2xl items-start gap-4'>
              <div className='rounded-xl bg-[var(--jr-accent-soft)] p-3 text-[var(--jr-accent-hover)]'>
                <LockKeyhole size={22} />
              </div>
              <div>
                <h2 className='text-xl font-semibold'>
                  Sign in to create a token
                </h2>
                <p className='mt-2 text-sm leading-6 text-[var(--jr-muted)]'>
                  Tokens belong to your account and can be revoked at any time.
                  The full secret is only shown once.
                </p>
                <button
                  type='button'
                  onClick={() =>
                    openSignIn({
                      fallbackRedirectUrl: '/mcp',
                      signUpFallbackRedirectUrl: '/mcp',
                    })
                  }
                  className='mt-5 cursor-pointer rounded-lg bg-[var(--jr-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--jr-accent-hover)]'
                >
                  Sign in to continue
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className='mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]'>
            <div className='space-y-8'>
              <section className='rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-6 sm:p-7'>
                <div className='flex items-start gap-3'>
                  <div className='rounded-lg bg-[var(--jr-accent-soft)] p-2 text-[var(--jr-accent-hover)]'>
                    <KeyRound size={19} />
                  </div>
                  <div>
                    <h2 className='text-xl font-semibold'>Create your token</h2>
                    <p className='mt-1 text-sm text-[var(--jr-muted)]'>
                      Signed in as{' '}
                      {user?.primaryEmailAddress?.emailAddress ||
                        'your account'}
                    </p>
                  </div>
                </div>

                <div className='mt-6 flex flex-col gap-3 sm:flex-row'>
                  <label className='sr-only' htmlFor='token-name'>
                    Token name
                  </label>
                  <input
                    id='token-name'
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={40}
                    placeholder='Cursor, Claude Code, work laptop…'
                    className='min-w-0 flex-1 rounded-xl border border-[var(--jr-border)] bg-[var(--jr-bg)] px-4 py-3 text-sm text-[var(--jr-text)] outline-none transition placeholder:text-[var(--jr-muted-2)] focus:border-[var(--jr-accent)] focus:ring-4 focus:ring-[var(--jr-accent)]/15'
                  />
                  <button
                    type='button'
                    onClick={createToken}
                    disabled={creating || name.trim().length === 0}
                    className='flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--jr-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--jr-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <Plus size={17} />
                    {creating ? 'Creating…' : 'Generate token'}
                  </button>
                </div>

                {error && (
                  <p
                    className='mt-3 text-sm text-[var(--jr-danger)]'
                    role='alert'
                  >
                    {error}
                  </p>
                )}

                {freshSecret && (
                  <div className='mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30'>
                    <div className='flex items-start gap-2 text-amber-950 dark:text-amber-200'>
                      <CheckCircle2 size={18} className='mt-0.5 shrink-0' />
                      <div>
                        <p className='text-sm font-semibold'>Token generated</p>
                        <p className='mt-0.5 text-xs opacity-75'>
                          Copy it now. For security, it will not be shown again.
                        </p>
                      </div>
                    </div>
                    <div className='mt-3 flex items-center gap-2'>
                      <code className='min-w-0 flex-1 overflow-x-auto rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-xs text-zinc-800 dark:border-amber-900 dark:bg-zinc-950 dark:text-zinc-200'>
                        {freshSecret}
                      </code>
                      <CopyButton
                        copied={copied === 'secret'}
                        onClick={() => copy('secret', freshSecret)}
                        label='Copy token'
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className='overflow-hidden rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)]'>
                <div className='border-b border-[var(--jr-border)] p-6 sm:p-7'>
                  <h2 className='text-xl font-semibold'>Connect your agent</h2>
                  <p className='mt-2 text-sm leading-6 text-[var(--jr-muted)]'>
                    Use the token above in the <b>Authorization</b> header.
                    Never commit your token to a public repository.
                  </p>
                </div>

                <div className='grid grid-cols-2 border-b border-[var(--jr-border)] bg-[var(--jr-hover)] p-1.5'>
                  <GuideTab
                    active={guide === 'cursor'}
                    icon={<Code2 size={17} />}
                    label='Cursor'
                    onClick={() => setGuide('cursor')}
                  />
                  <GuideTab
                    active={guide === 'claude'}
                    icon={<Terminal size={17} />}
                    label='Claude Code'
                    onClick={() => setGuide('claude')}
                  />
                </div>

                <div className='p-6 sm:p-7'>
                  {guide === 'cursor' ? (
                    <CursorGuide
                      value={samples.cursor}
                      copied={copied === 'cursor'}
                      onCopy={() => copy('cursor', samples.cursor)}
                    />
                  ) : (
                    <ClaudeGuide
                      value={samples.claude}
                      copied={copied === 'claude'}
                      onCopy={() => copy('claude', samples.claude)}
                    />
                  )}
                </div>
              </section>
            </div>

            <aside className='space-y-6'>
              <section className='rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-6'>
                <div className='flex items-center justify-between'>
                  <h2 className='font-semibold'>Active tokens</h2>
                  <span className='rounded-full bg-[var(--jr-hover)] px-2.5 py-1 text-xs font-medium text-[var(--jr-text-2)]'>
                    {tokens.length}/10
                  </span>
                </div>
                {tokens.length === 0 ? (
                  <div className='mt-5 rounded-xl border border-dashed border-[var(--jr-border)] px-4 py-7 text-center'>
                    <KeyRound
                      size={22}
                      className='mx-auto text-[var(--jr-muted-2)]'
                    />
                    <p className='mt-2 text-sm text-[var(--jr-muted)]'>
                      No active tokens yet
                    </p>
                  </div>
                ) : (
                  <ul className='mt-4 space-y-2'>
                    {tokens.map((token) => (
                      <li
                        key={token.id}
                        className='group rounded-xl border border-[var(--jr-border)] p-3.5'
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='truncate text-sm font-semibold'>
                              {token.name}
                            </p>
                            <code className='mt-1 block text-[11px] text-[var(--jr-muted)]'>
                              {token.tokenPrefix}…
                            </code>
                          </div>
                          <button
                            type='button'
                            onClick={() => revoke(token.id)}
                            className='cursor-pointer rounded-lg p-2 text-[var(--jr-muted-2)] transition hover:bg-[var(--jr-danger-soft)] hover:text-[var(--jr-danger)]'
                            aria-label={`Revoke ${token.name}`}
                            title={`Revoke “${token.name}”`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p className='mt-2 text-[11px] text-[var(--jr-muted-2)]'>
                          Last used: {formatWhen(token.lastUsedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className='rounded-[14px] border border-[var(--jr-accent)]/25 bg-[var(--jr-accent-soft)] p-6'>
                <h3 className='flex items-center gap-2 font-semibold text-[var(--jr-accent-hover)]'>
                  <Sparkles size={17} />
                  Try it
                </h3>
                <p className='mt-2 text-sm leading-6 text-[var(--jr-accent-hover)]/80'>
                  After connecting, ask:
                </p>
                <blockquote className='mt-3 rounded-lg border border-[var(--jr-accent)]/20 bg-[var(--jr-surface)] p-3 text-sm font-medium text-[var(--jr-text)]'>
                  “Publish this Markdown with JSON Rock and give me the share
                  link.”
                </blockquote>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className='flex items-center gap-2.5 rounded-xl border border-[var(--jr-border)] bg-[var(--jr-bg)] px-4 py-3'>
      <span className='text-[var(--jr-accent)]'>{icon}</span>
      <span className='text-[var(--jr-text)]'>{text}</span>
    </div>
  )
}

function Step({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <div className='flex items-center gap-3 rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-4'>
      <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--jr-accent)] text-xs font-bold text-white'>
        {number}
      </span>
      <div>
        <p className='text-sm font-semibold text-[var(--jr-text)]'>{title}</p>
        <p className='text-xs text-[var(--jr-muted)]'>{text}</p>
      </div>
    </div>
  )
}

function GuideTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
        active
          ? 'bg-[var(--jr-surface)] text-[var(--jr-text)] shadow-sm'
          : 'text-[var(--jr-muted)] hover:text-[var(--jr-text)]'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function CursorGuide({
  value,
  copied,
  onCopy,
}: {
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div>
      <h3 className='font-semibold'>Connect in Cursor</h3>
      <ol className='mt-4 space-y-4 text-sm text-[var(--jr-muted)]'>
        <Instruction number='1'>
          Create <Path>.cursor/mcp.json</Path> in one project, or{' '}
          <Path>~/.cursor/mcp.json</Path> to enable JSON Rock in every project.
        </Instruction>
        <Instruction number='2'>
          Paste the configuration below. Replace <Path>jr_mcp_your_token</Path>{' '}
          with the token generated above.
        </Instruction>
        <Instruction number='3'>
          Open{' '}
          <b className='text-[var(--jr-text)]'>Cursor Settings → Tools & MCP</b>{' '}
          and confirm <b className='text-[var(--jr-text)]'>jsonrock</b> is
          enabled.
        </Instruction>
      </ol>
      <CodeBlock
        label='.cursor/mcp.json'
        language='json'
        value={value}
        copied={copied}
        onCopy={onCopy}
      />
    </div>
  )
}

function ClaudeGuide({
  value,
  copied,
  onCopy,
}: {
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div>
      <h3 className='font-semibold'>Connect in Claude Code</h3>
      <ol className='mt-4 space-y-4 text-sm text-[var(--jr-muted)]'>
        <Instruction number='1'>
          Open Terminal. Replace <Path>jr_mcp_your_token</Path> below with your
          generated token, then run the command.
        </Instruction>
        <Instruction number='2'>
          The token is stored by Claude Code in your user MCP configuration. The{' '}
          <Path>--scope user</Path> option makes it available in all projects.
        </Instruction>
        <Instruction number='3'>
          Run <Path>claude mcp list</Path> to confirm that{' '}
          <b className='text-[var(--jr-text)]'>jsonrock</b> is connected.
        </Instruction>
      </ol>
      <CodeBlock
        label='Terminal'
        language='bash'
        value={value}
        copied={copied}
        onCopy={onCopy}
      />
    </div>
  )
}

function Instruction({
  number,
  children,
}: {
  number: string
  children: React.ReactNode
}) {
  return (
    <li className='flex gap-3'>
      <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--jr-hover)] text-[11px] font-bold text-[var(--jr-text-2)]'>
        {number}
      </span>
      <span className='leading-6'>{children}</span>
    </li>
  )
}

function Path({ children }: { children: React.ReactNode }) {
  return (
    <code className='rounded bg-[var(--jr-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--jr-text)]'>
      {children}
    </code>
  )
}

function CodeBlock({
  label,
  language,
  value,
  copied,
  onCopy,
}: {
  label: string
  language: 'json' | 'bash'
  value: string
  copied: boolean
  onCopy: () => void
}) {
  const [isDark, setIsDark] = useState(getIsDarkMode)

  useEffect(() => {
    const syncTheme = () => setIsDark(getIsDarkMode())
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={cn(
        'mt-6 overflow-hidden rounded-xl border border-[var(--jr-border)]',
        isDark ? 'bg-[var(--jr-code-bg)]' : 'bg-[#fafafa]'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-4 py-2.5',
          isDark ? 'border-white/10' : 'border-[var(--jr-border)]'
        )}
      >
        <span className='flex items-center gap-2 text-xs font-medium text-[var(--jr-muted)]'>
          <Clipboard size={13} />
          {label}
        </span>
        <button
          type='button'
          onClick={onCopy}
          title={copied ? 'Copied' : 'Copy to clipboard'}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition',
            isDark
              ? 'text-[var(--jr-muted)] hover:bg-white/10 hover:text-white'
              : 'text-[var(--jr-muted)] hover:bg-[var(--jr-hover)] hover:text-[var(--jr-text)]'
          )}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={isDark ? vscDarkPlus : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.75rem',
          lineHeight: 1.65,
          padding: '1rem',
          background: 'transparent',
        }}
        codeTagProps={{
          style: {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
        }}
        showLineNumbers={false}
        wrapLongLines={false}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}

function CopyButton({
  copied,
  onClick,
  label,
}: {
  copied: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='cursor-pointer rounded-lg border border-amber-300 bg-white p-2.5 text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-amber-950'
      aria-label={label}
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  )
}
