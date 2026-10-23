import type { CSSProperties } from 'react'
import { avatarColor, initials } from '@/lib/library-format'
import { cn } from '@/lib/utils'

export interface AvatarProps {
  name: string
  /** Seed for the colour; defaults to the name. */
  colorKey?: string
  /** Pixel size (26 in stacks, 34 in lists, 38 in the top bar). */
  size?: number
  /** White ring used when avatars overlap. */
  ring?: boolean
  /** Dashed placeholder (pending invitee). */
  dashed?: boolean
  /** Override initials, e.g. "+2". */
  label?: string
  muted?: boolean
  /** Clerk (or other) profile image URL. */
  imageUrl?: string | null
  className?: string
  style?: CSSProperties
}

export function Avatar({
  name,
  colorKey,
  size = 34,
  ring,
  label,
  muted,
  imageUrl,
  className,
  style,
}: AvatarProps) {
  const showImage = Boolean(imageUrl) && !label && !muted

  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        ring && 'border-2 border-[var(--jr-surface)]',
        muted && 'text-[#334155]',
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size <= 26 ? 11 : size <= 34 ? 12 : 13,
        backgroundColor: showImage
          ? 'transparent'
          : muted
            ? '#e2e8f0'
            : avatarColor(colorKey ?? name),
        ...style,
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Clerk CDN URLs
        <img
          src={imageUrl!}
          alt=''
          width={size}
          height={size}
          className='h-full w-full object-cover'
          referrerPolicy='no-referrer'
        />
      ) : (
        (label ?? initials(name))
      )}
    </span>
  )
}
