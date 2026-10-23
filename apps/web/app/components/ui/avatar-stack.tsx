import { Avatar } from './avatar'
import { cn } from '@/lib/utils'

export interface AvatarStackProps {
  members: { id: string; name: string; imageUrl?: string }[]
  /** Total member count, when `members` is only a preview. */
  total?: number
  /** Max avatars before the "+N" chip. */
  max?: number
  size?: number
  className?: string
}

export function AvatarStack({
  members,
  total,
  max = 3,
  size = 26,
  className,
}: AvatarStackProps) {
  const count = Math.max(total ?? members.length, members.length)
  const shown = members.slice(0, max)
  const extra = count - shown.length

  return (
    <div className={cn('flex items-center', className)}>
      {shown.map((m, i) => (
        <Avatar
          key={m.id}
          name={m.name}
          colorKey={m.id}
          imageUrl={m.imageUrl}
          size={size}
          ring
          style={i > 0 ? { marginLeft: -8 } : undefined}
        />
      ))}
      {extra > 0 && (
        <Avatar
          name={`${extra} more`}
          label={`+${extra}`}
          size={size}
          ring
          muted
          style={{ marginLeft: -8 }}
        />
      )}
    </div>
  )
}
