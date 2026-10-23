'use client'

import { ShareType } from '@/app/iterface'
import { cn } from '@/lib/utils'
import {
  Braces,
  ChevronDown,
  Code2,
  File,
  FileText,
  GitCompareArrows,
  History,
  Home,
  LinkIcon,
  Loader2,
  MoreHorizontal,
} from 'lucide-react'
import { ThemeToggle } from '../button/theme-toggle'
import HeaderLogo from './header/header-logo'
import SaveStatus from './header/save-status'
import EditorActionBtn from '../button/editor-action-btn'
import Link from 'next/link'
import Image from 'next/image'
import { FaGithub } from 'react-icons/fa6'
import { useAuth, useUser } from '@clerk/nextjs'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AccountMenu } from '../account-menu'
import { PortalFullScreenLoader } from '../Loader'
import { invalidateRemoteLibrary } from '@/lib/api/library-cache'
import { createRemoteFile } from '@/lib/create-project-file'
import { isProjectsEnabled } from '@/lib/feature-flags'
import { signedInHomePath } from '@/lib/home'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useHomeHref } from '@/hooks/use-home-href'
import { useRemoteFile } from '@/hooks/use-remote-file'
import type { DocType } from '@/types/library'
import { DocumentBreadcrumb } from './header/document-breadcrumb'
import { NewDocumentMenu, type NewMenuItem } from './header/new-document-menu'
import { HeaderActions } from './header/header-actions'

interface Props {
  documentType: ShareType
  documentSlug: string | null
  isJsonValid: boolean
  isAutoSaving: boolean
  currentViewMode: string
  onCreateNewDocument: (x: ShareType) => void
  onOpenShareModal: (x: boolean) => void
  onOpenUploadModal: (x: boolean) => void
  onOpenHistoryModal: (x: boolean) => void
  /** Shared markdown preview-only: hide editor creation nav; show view-only cue. */
  previewOnlyView?: boolean
}

type HeaderAction = {
  id: string
  label: string
  title: string
  href: string
  icon: React.ReactNode
  activeType?: ShareType
}

/** Order = hide last → first. Diff overflows into Other before Markdown/Text/JSON. */
const HEADER_ACTIONS: HeaderAction[] = [
  {
    id: 'json',
    label: 'New JSON',
    title: 'Create New JSON',
    href: '/editor',
    icon: <Braces size={14} />,
    activeType: 'json',
  },
  {
    id: 'text',
    label: 'New Text',
    title: 'Create New Text Chat',
    href: '/editor/text',
    icon: <File size={14} />,
    activeType: 'text',
  },
  {
    id: 'markdown',
    label: 'New Markdown',
    title: 'Create New Markdown',
    href: '/editor/markdown',
    icon: <FileText size={14} />,
    activeType: 'markdown',
  },
  {
    id: 'html',
    label: 'New HTML',
    title: 'Create New HTML Viewer',
    href: '/editor/html',
    icon: <Code2 size={14} />,
    activeType: 'html',
  },
  {
    id: 'diff',
    label: 'Diff Checker',
    title: 'JSON Diff Checker',
    href: '/diff',
    icon: <GitCompareArrows size={14} />,
  },
]

const GAP_PX = 8

const iconBtnClass = () =>
  cn(
    'p-2 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 hover:cursor-pointer',
    'dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
  )

const LegacyEditorHeader = ({
  documentType,
  documentSlug,
  isJsonValid,
  isAutoSaving,
  onOpenShareModal,
  currentViewMode,
  onOpenHistoryModal,
  previewOnlyView = false,
}: Props) => {
  const { isSignedIn, isLoaded: isUserLoaded } = useUser()
  const [isPending, startTransition] = useTransition()
  const [isOtherOpen, setIsOtherOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(HEADER_ACTIONS.length)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  // Keeps the browser tab title in sync with the open file name.
  useDocumentTitle(documentSlug, documentType, { isSaving: isAutoSaving })

  const headerRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const otherBtnRef = useRef<HTMLButtonElement>(null)
  const otherMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const recalculateOverflow = useCallback(() => {
    const header = headerRef.current
    const left = leftRef.current
    const right = rightRef.current
    const measure = measureRef.current
    if (!header || !left || !right || !measure) return

    const headerStyle = getComputedStyle(header)
    const padX =
      parseFloat(headerStyle.paddingLeft) + parseFloat(headerStyle.paddingRight)
    // Keep a buffer so center never collides with left/right zones
    const sideGap = 20
    const available = Math.max(
      0,
      header.clientWidth -
        left.offsetWidth -
        right.offsetWidth -
        padX -
        sideGap * 2
    )

    const actionEls = Array.from(
      measure.querySelectorAll<HTMLElement>('[data-measure-action]')
    )
    const otherEl = measure.querySelector<HTMLElement>('[data-measure-other]')
    if (!actionEls.length || !otherEl) return

    const otherWidth = otherEl.offsetWidth
    const widths = actionEls.map((el) => el.offsetWidth)

    // Prefer showing everything outside Other when space allows
    let used = 0
    let fitsAll = true
    for (let i = 0; i < widths.length; i++) {
      const width = widths[i] ?? 0
      used += width + (i > 0 ? GAP_PX : 0)
      if (used > available) {
        fitsAll = false
        break
      }
    }
    if (fitsAll) {
      setVisibleCount(widths.length)
      return
    }

    // Otherwise fit as many as possible, reserving room for Other
    let count = 0
    used = otherWidth
    for (let i = 0; i < widths.length; i++) {
      const width = widths[i] ?? 0
      const next = used + GAP_PX + width
      if (next > available) break
      used = next
      count++
    }

    // 0 is allowed — only Other shows in the center
    setVisibleCount(count)
  }, [])

  useLayoutEffect(() => {
    recalculateOverflow()

    const header = headerRef.current
    if (!header) return

    const observer = new ResizeObserver(() => {
      recalculateOverflow()
    })
    observer.observe(header)
    if (leftRef.current) observer.observe(leftRef.current)
    if (rightRef.current) observer.observe(rightRef.current)

    window.addEventListener('resize', recalculateOverflow)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recalculateOverflow)
    }
  }, [recalculateOverflow])

  const updateMenuPosition = useCallback(() => {
    const btn = otherBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 6,
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 96),
        window.innerWidth - 96
      ),
    })
  }, [])

  useEffect(() => {
    if (!isOtherOpen) return

    updateMenuPosition()

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        otherBtnRef.current?.contains(target) ||
        otherMenuRef.current?.contains(target)
      ) {
        return
      }
      setIsOtherOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOtherOpen(false)
    }

    const handleReposition = () => updateMenuPosition()

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOtherOpen, updateMenuPosition])

  const navigateTo = (href: string) => {
    setIsOtherOpen(false)
    startTransition(() => {
      router.push(href)
    })
  }

  const visibleActions = HEADER_ACTIONS.slice(0, visibleCount)
  const overflowActions = HEADER_ACTIONS.slice(visibleCount)
  const showOther = overflowActions.length > 0

  useEffect(() => {
    if (!showOther && isOtherOpen) setIsOtherOpen(false)
  }, [showOther, isOtherOpen])

  const actionBtnClass = (isActive?: boolean) =>
    cn(
      'flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium border transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none hover:cursor-pointer whitespace-nowrap',
      isActive
        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-900/20'
        : cn(
            'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200',
            'dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          )
    )

  const otherTriggerClass = cn(
    'flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium border transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none hover:cursor-pointer whitespace-nowrap',
    isOtherOpen
      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-900/20'
      : cn(
          'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200',
          'dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
        )
  )

  return (
    <header
      ref={headerRef}
      className={cn(
        'relative h-14 border-b border-zinc-200 flex items-center justify-between gap-2 px-2 sm:px-3 lg:px-6 bg-white shrink-0',
        'dark:border-zinc-900 dark:bg-zinc-950'
      )}
    >
      {/* Hidden measurement row */}
      <div
        ref={measureRef}
        aria-hidden
        className='pointer-events-none absolute -left-2499.75 top-0 flex items-center gap-2 opacity-0'
      >
        {HEADER_ACTIONS.map((action) => (
          <div
            key={action.id}
            data-measure-action
            className={actionBtnClass(false)}
          >
            {action.icon}
            <span className='hidden lg:inline'>{action.label}</span>
          </div>
        ))}
        <div data-measure-other className={otherTriggerClass}>
          <MoreHorizontal size={14} />
          <span className='hidden lg:inline'>Other</span>
          <ChevronDown size={12} />
        </div>
      </div>

      {/* Left: logo */}
      <div
        ref={leftRef}
        className='flex items-center gap-2 sm:gap-3 z-10 min-w-0 shrink-0'
      >
        <HeaderLogo
          type={documentType}
          slug={documentSlug}
          isValid={isJsonValid}
          viewMode={currentViewMode}
        />
      </div>

      {/* Center: editor nav — hidden for preview-only shared markdown */}
      {previewOnlyView ? (
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
          <span className='text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500'>
            View only
          </span>
        </div>
      ) : (
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2'>
          {visibleActions.map((action) => (
            <EditorActionBtn
              key={action.id}
              href={action.href}
              documentType={documentType}
              label={action.label}
              title={action.title}
              icon={action.icon}
              isActive={
                action.activeType !== undefined &&
                documentType === action.activeType
              }
            />
          ))}

          {showOther && (
            <button
              ref={otherBtnRef}
              type='button'
              onClick={() => {
                updateMenuPosition()
                setIsOtherOpen((open) => !open)
              }}
              aria-expanded={isOtherOpen}
              aria-haspopup='menu'
              aria-label='Other tools'
              className={otherTriggerClass}
            >
              <MoreHorizontal size={14} />
              <span className='hidden lg:inline'>Other</span>
              <ChevronDown
                size={12}
                className={cn(
                  'transition-transform',
                  isOtherOpen && 'rotate-180'
                )}
              />
            </button>
          )}
        </div>
      )}

      {mounted &&
        isOtherOpen &&
        showOther &&
        createPortal(
          <div
            ref={otherMenuRef}
            role='menu'
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              transform: 'translateX(-50%)',
            }}
            className={cn(
              'z-200 min-w-48 max-w-[calc(100vw-1.5rem)] rounded-lg border border-zinc-200 bg-white p-1 shadow-xl',
              'dark:border-zinc-800 dark:bg-zinc-950'
            )}
          >
            {overflowActions.map((item) => (
              <button
                key={item.id}
                type='button'
                role='menuitem'
                onClick={() => navigateTo(item.href)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 hover:cursor-pointer',
                  'dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
                  item.activeType !== undefined &&
                    documentType === item.activeType &&
                    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}

      {/* Right: utilities */}
      <div
        ref={rightRef}
        className='flex items-center gap-0.5 sm:gap-1 z-10 shrink-0'
      >
        <SaveStatus isAutoSaving={isAutoSaving} documentType={documentType} />

        <div
          className={cn(
            'h-5 w-px bg-zinc-200 mx-0.5 sm:mx-1',
            'dark:bg-zinc-800'
          )}
        />

        <button
          onClick={() => onOpenHistoryModal(true)}
          className={iconBtnClass()}
          title='Open Local History'
          aria-label='Open Local History'
        >
          <History size={18} />
        </button>

        <button
          onClick={() =>
            !documentSlug || isAutoSaving ? undefined : onOpenShareModal(true)
          }
          disabled={!documentSlug || isAutoSaving}
          className={cn(
            'p-2 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none',
            !documentSlug
              ? 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed opacity-50'
              : isAutoSaving
                ? 'text-emerald-600 dark:text-emerald-400 cursor-wait opacity-80'
                : cn(
                    'text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer',
                    'dark:hover:text-emerald-400'
                  )
          )}
          title={
            !documentSlug
              ? 'Save document first to share'
              : isAutoSaving
                ? 'Saving changes...'
                : 'Share Link'
          }
          aria-label={
            !documentSlug
              ? 'Share Link (disabled - save document first)'
              : isAutoSaving
                ? 'Saving changes...'
                : 'Share Link'
          }
        >
          {isAutoSaving && documentSlug ? (
            <Loader2
              size={18}
              className='animate-spin text-emerald-600 dark:text-emerald-400'
            />
          ) : (
            <LinkIcon size={18} />
          )}
        </button>

        <div className='dark:text-zinc-400'>
          <ThemeToggle />
        </div>

        <Link
          href='/mcp'
          className={iconBtnClass()}
          title='MCP — create a token for AI agents'
          aria-label='MCP tokens'
        >
          <Image
            src='/mcp.png'
            alt=''
            width={18}
            height={18}
            className='h-[18px] w-[18px] invert dark:invert-0'
          />
        </Link>

        <Link
          href='https://github.com/Softcolon-Technology/jsonrock'
          target='_blank'
          rel='noopener noreferrer'
          className={cn(
            iconBtnClass(),
            'hidden md:flex items-center justify-center'
          )}
          title='View Source on GitHub'
          aria-label='View Source on GitHub'
        >
          <FaGithub size={18} />
        </Link>

        {isPending && <PortalFullScreenLoader />}
        <HomeNavLink
          className={cn(
            iconBtnClass(),
            'hidden sm:flex items-center justify-center'
          )}
        />

        {isSignedIn ? <AccountMenu className='ml-1 flex items-center' /> : null}
      </div>
    </header>
  )
}

const NEW_MENU_LABEL: Record<string, string> = {
  json: 'JSON',
  text: 'Text',
  markdown: 'Markdown',
  html: 'HTML',
  diff: 'Diff checker',
}

function withRenameQuery(openUrl: string): string {
  try {
    const url = new URL(openUrl, window.location.origin)
    url.searchParams.set('rename', '1')
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    const join = openUrl.includes('?') ? '&' : '?'
    return `${openUrl}${join}rename=1`
  }
}

/** Workspace header when projects are enabled: breadcrumb + New / Workspace / Share / bell / avatar. */
const ProjectsEditorHeader = ({
  documentType,
  documentSlug,
  isJsonValid,
  isAutoSaving,
  onOpenShareModal,
  currentViewMode,
  previewOnlyView = false,
}: Props) => {
  const { isSignedIn, getToken } = useAuth()
  const { isSignedIn: userSignedIn } = useUser()
  const signedIn = isSignedIn || userSignedIn
  const [isPending, startTransition] = useTransition()
  const [saveIntoProject, setSaveIntoProject] = useState(false)
  const [focusRename, setFocusRename] = useState(false)
  const router = useRouter()
  const { file, project, rename: renameRemote } = useRemoteFile(documentSlug)
  const activeProjectId = project?.id ?? file?.projectId ?? null
  const isRemoteViewer = file?.role === 'viewer'

  // When editing a project file, default New → create into that project.
  useEffect(() => {
    if (activeProjectId) setSaveIntoProject(true)
  }, [activeProjectId])
  const { title, rename, canRename } = useDocumentTitle(
    documentSlug,
    documentType,
    {
      isSaving: isAutoSaving,
      // Always PATCH when signed in (file may not be in the library cache yet).
      remoteRename: signedIn && !isRemoteViewer ? renameRemote : null,
      remoteTitle: file?.title,
    }
  )

  // Focus title after New → create (URL has ?rename=1); strip the flag once.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('rename') !== '1') return
    setFocusRename(true)
    url.searchParams.delete('rename')
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`
    )
  }, [documentSlug])

  // Same navigation as the legacy header's `navigateTo`.
  const navigateTo = (href: string) => {
    startTransition(() => {
      router.push(href)
    })
  }

  const createFile = useCallback(
    async (item: NewMenuItem) => {
      if (!signedIn) return null
      if (item.id === 'diff') return null
      const type = item.id as DocType
      if (!['json', 'text', 'markdown', 'html'].includes(type)) return null
      const intoProject =
        saveIntoProject && activeProjectId ? activeProjectId : null
      const { openUrl } = await createRemoteFile(getToken, type, intoProject)
      invalidateRemoteLibrary()
      return withRenameQuery(openUrl)
    },
    [signedIn, getToken, saveIntoProject, activeProjectId]
  )

  return (
    <header
      data-testid='jr-header'
      className={cn(
        'relative z-10 flex h-[60px] shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 sm:gap-5 sm:px-5',
        'dark:border-zinc-900 dark:bg-zinc-950'
      )}
    >
      <div className='shrink-0'>
        <HeaderLogo
          type={documentType}
          slug={documentSlug}
          isValid={isJsonValid}
          viewMode={currentViewMode}
        />
      </div>

      <DocumentBreadcrumb
        documentType={documentType}
        title={title}
        onRename={rename}
        canRename={canRename && !previewOnlyView && !isRemoteViewer}
        isAutoSaving={isAutoSaving}
        isPersisted={!!documentSlug}
        autoFocusRename={focusRename && !!documentSlug}
        projectId={activeProjectId}
        projectName={project?.name ?? null}
      />

      <span className='flex-1' />

      <div className='flex shrink-0 items-center gap-2'>
        {previewOnlyView ? (
          <span className='text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500'>
            View only
          </span>
        ) : (
          <NewDocumentMenu
            items={HEADER_ACTIONS.map((a) => ({
              id: a.id,
              label: NEW_MENU_LABEL[a.id] ?? a.label,
              href: a.href,
              icon: a.icon,
            }))}
            primaryId={documentType}
            onNavigate={navigateTo}
            onCreateFile={signedIn ? createFile : undefined}
            projectId={activeProjectId}
            projectName={project?.name ?? null}
            saveIntoProject={saveIntoProject}
            onSaveIntoProjectChange={setSaveIntoProject}
          />
        )}
        <HeaderActions
          isSignedIn={!!signedIn}
          documentSlug={documentSlug}
          isAutoSaving={isAutoSaving}
          onOpenShare={() => onOpenShareModal(true)}
          onGoHome={() => navigateTo(signedInHomePath())}
        />
      </div>
      {isPending && <PortalFullScreenLoader />}
    </header>
  )
}

function HomeNavLink({ className }: { className?: string }) {
  const homeHref = useHomeHref()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <>
      {isPending && <PortalFullScreenLoader />}
      <Link
        href={homeHref}
        onClick={(e) => {
          e.preventDefault()
          startTransition(() => {
            router.push(homeHref)
          })
        }}
        className={className}
        title='Go to Home'
        aria-label='Go to Home'
      >
        <Home size={18} />
      </Link>
    </>
  )
}

const EditorHeader = (props: Props) =>
  isProjectsEnabled ? (
    <ProjectsEditorHeader {...props} />
  ) : (
    <LegacyEditorHeader {...props} />
  )

export default EditorHeader
