import { cn } from '@/lib/utils'
import { ShareType } from '@/app/iterface'
import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PortalFullScreenLoader } from '../Loader'

interface Props {
  documentType: ShareType
  onClick?: () => void
  href?: string
  label: string
  title: string
  icon: React.ReactNode
  shortcut?: string
  isActive?: boolean
}

const EditorActionBtn = ({
  onClick,
  href,
  documentType,
  label,
  title,
  icon,
  shortcut,
  isActive,
}: Props) => {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const className = cn(
    'flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium border transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none',
    isActive
      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-900/20'
      : cn(
          'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200',
          documentType !== 'text' &&
            'dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
        )
  )

  const content = (
    <>
      {icon}
      <span className='hidden lg:inline'>{label}</span>
    </>
  )

  if (href) {
    return (
      <>
        {isPending && <PortalFullScreenLoader />}
        <Link
          href={href}
          onClick={(e) => {
            e.preventDefault()
            startTransition(() => {
              router.push(href)
            })
          }}
          className={className}
          title={shortcut ? `${title} (${shortcut})` : title}
          aria-label={label}
        >
          {content}
        </Link>
      </>
    )
  }

  return (
    <button
      onClick={onClick}
      className={className}
      title={shortcut ? `${title} (${shortcut})` : title}
      aria-label={label}
    >
      {content}
    </button>
  )
}

export default EditorActionBtn
