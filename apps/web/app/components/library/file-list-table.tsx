'use client'

import type { ReactNode } from 'react'

export interface FileListTableProps {
  children: ReactNode
  /** Accessible name for the table. */
  label?: string
  className?: string
}

/** Responsive file table: real table on sm+, stacked rows on mobile. */
export function FileListTable({
  children,
  label = 'Files',
  className,
}: FileListTableProps) {
  return (
    <div
      className={
        className ??
        'overflow-hidden rounded-[14px] border border-[var(--jr-border)] bg-[var(--jr-surface)]'
      }
    >
      <table
        aria-label={label}
        className='w-full border-collapse text-left max-sm:block'
      >
        <thead className='sr-only'>
          <tr>
            <th scope='col'>Type</th>
            <th scope='col'>Name</th>
            <th scope='col'>Actions</th>
          </tr>
        </thead>
        <tbody className='max-sm:block'>{children}</tbody>
      </table>
    </div>
  )
}
