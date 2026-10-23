'use client'

import { Avatar } from '../ui/avatar'
import { RolePill } from '../ui/pill'
import { RoleSelect, type RoleSelectValue } from '../ui/role-select'
import type { ProjectMember } from '@/types/library'

export interface MemberRowProps {
  member: ProjectMember
  /** Viewer is the project owner and can change roles. */
  canManage?: boolean
  onChangeRole?: (member: ProjectMember, value: RoleSelectValue) => void
}

export function MemberRow({ member, canManage, onChangeRole }: MemberRowProps) {
  const editable = canManage && member.role !== 'owner' && !member.isYou
  return (
    <div
      data-testid={`jr-member-${member.userId}`}
      data-user-id={member.userId}
      className='flex items-center gap-3 border-b border-[var(--jr-border)] px-4 py-3 max-sm:flex-wrap'
    >
      <Avatar
        name={member.name}
        colorKey={member.userId}
        imageUrl={member.imageUrl}
        size={34}
      />
      <div className='flex min-w-0 flex-1 flex-col gap-px'>
        <span className='truncate font-semibold'>
          {member.name}
          {member.isYou && (
            <>
              {' '}
              <span className='font-medium text-[var(--jr-muted-2)]'>
                (you)
              </span>
            </>
          )}
        </span>
        <span className='truncate text-xs text-[var(--jr-muted)]'>
          {member.email}
        </span>
      </div>
      {editable && member.role !== 'owner' ? (
        <RoleSelect
          allowRemove
          label={`Role for ${member.name}`}
          value={member.role}
          onChange={(v) => onChangeRole?.(member, v)}
          testId={`jr-role-select-${member.userId}`}
        />
      ) : (
        <RolePill role={member.role} data-testid='member-role' />
      )}
    </div>
  )
}
