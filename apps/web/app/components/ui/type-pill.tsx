import type { DocType } from '@/types/library'
import { DOC_TYPE_LABEL } from '@/lib/library-format'
import { cn } from '@/lib/utils'

const styles: Record<DocType, string> = {
  json: 'bg-[var(--jr-accent-soft)] text-[var(--jr-accent-hover)]',
  text: 'bg-[#f1f5f9] text-[#334155]',
  markdown: 'bg-[#f5f3ff] text-[#6d28d9]',
  html: 'bg-[#fff7ed] text-[#c2410c]',
}

export function TypePill({
  type,
  className,
}: {
  type: DocType
  className?: string
}) {
  return (
    <span
      data-testid='type-pill'
      className={cn(
        'box-border inline-block w-11 shrink-0 rounded-md px-2 py-1 text-center font-mono text-[11px] font-bold leading-none',
        styles[type],
        className
      )}
    >
      {DOC_TYPE_LABEL[type]}
    </span>
  )
}
