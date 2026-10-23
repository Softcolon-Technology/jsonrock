'use client'

import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { CheckCircle2, MailQuestion, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Button, buttonClasses } from '../ui/button'
import {
  acceptInvite,
  declineInvite,
  getInviteByToken,
} from '@/lib/api/invites'
import { isApiError } from '@/lib/api/client'
import { invalidateRemoteLibrary } from '@/lib/api/library-cache'
import { pluralize } from '@/lib/library-format'
import type { ProjectInvite } from '@/types/library'
import { useInviteContext } from './invite-provider'

const CARD =
  'flex flex-col gap-[22px] rounded-[18px] border border-[var(--jr-border)] bg-[var(--jr-surface)] p-9 max-sm:p-5'
const HEADING =
  'm-0 text-[26px] font-bold leading-tight tracking-[-0.02em] max-sm:text-[22px]'
const LEAD = 'm-0 text-[15px] leading-[1.55] text-[var(--jr-text-2)]'

const ROLE_COPY: Record<ProjectInvite['role'], string> = {
  editor: 'create, edit, rename and move files in this project',
  viewer: 'view the files in this project (read-only)',
}

function expiresIn(value?: string): string | null {
  if (!value) return null
  const ms = new Date(value).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'expired'
  const days = Math.ceil(ms / 86_400_000)
  return `in ${pluralize(days, 'day')}`
}

export interface InviteAcceptPageProps {
  token: string
}

export function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const router = useRouter()
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const { openSignIn, signOut } = useClerk()
  const removeLocalInvite = useInviteContext()?.remove

  const [invite, setInvite] = useState<ProjectInvite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const returnUrl = `/workspace?invite=${encodeURIComponent(token)}`

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    let cancelled = false
    getInviteByToken(getToken, token)
      .then((res) => !cancelled && setInvite(res.invite))
      .catch((e: unknown) => {
        if (cancelled) return
        setError(
          isApiError(e) && e.kind === 'not_found'
            ? 'This invite is no longer valid. It may have expired or been revoked.'
            : e instanceof Error
              ? e.message
              : 'Could not load this invite'
        )
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, getToken, token])

  const accept = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await acceptInvite(getToken, token)
      // Drop local toast state immediately — socket may not be connected yet
      // (e.g. accept via email right after sign-in).
      removeLocalInvite?.(token)
      invalidateRemoteLibrary()
      router.replace(
        `/workspace/projects/${encodeURIComponent(res?.projectId ?? invite?.projectId ?? '')}`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept invite')
      setBusy(false)
    }
  }, [getToken, token, router, invite, removeLocalInvite])

  const decline = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await declineInvite(getToken, token)
      removeLocalInvite?.(token)
      router.replace('/workspace')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decline invite')
      setBusy(false)
    }
  }, [getToken, token, router, removeLocalInvite])

  const wrap = (children: React.ReactNode) => (
    <main
      data-testid='jr-invite-page'
      className='mx-auto box-border w-full max-w-[600px] px-7 py-14 max-sm:px-3.5 max-sm:py-5'
    >
      {children}
    </main>
  )

  if (!isLoaded || (isSignedIn && loading)) {
    return wrap(
      <div
        data-testid='invite-loading'
        aria-busy='true'
        className='h-72 animate-pulse rounded-[18px] border border-[var(--jr-border)] bg-[var(--jr-surface)]'
      />
    )
  }

  /* ── Signed out ─────────────────────────────────────────────── */
  if (!isSignedIn) {
    return wrap(
      <section
        aria-labelledby='signin-h'
        data-testid='invite-signed-out'
        className={CARD}
      >
        <IconTile>
          <UserPlus size={26} />
        </IconTile>
        <div className='flex flex-col gap-2'>
          <h1 id='signin-h' className={HEADING}>
            Sign in to view your invite
          </h1>
          <p className={LEAD}>
            Sign in with the email address that received the invite. You’ll come
            right back here to accept it.
          </p>
        </div>
        <div className='flex gap-2.5 max-sm:flex-col'>
          <Button
            variant='primary'
            className='h-11 flex-1 rounded-xl text-[15px]'
            onClick={() => openSignIn({ forceRedirectUrl: returnUrl })}
            data-testid='invite-sign-in'
          >
            Sign in
          </Button>
          <Link
            href='/'
            className={buttonClasses({
              className:
                'h-11 rounded-xl px-[18px] text-[15px] text-[#334155] no-underline',
            })}
          >
            Not now
          </Link>
        </div>
      </section>
    )
  }

  /* ── Invalid / error ────────────────────────────────────────── */
  if (!invite) {
    return wrap(
      <section className={CARD} data-testid='invite-error'>
        <IconTile>
          <MailQuestion size={26} />
        </IconTile>
        <div className='flex flex-col gap-2'>
          <h1 className={HEADING}>Invite unavailable</h1>
          <p className={LEAD}>{error ?? 'We could not find this invite.'}</p>
        </div>
        <Link
          href='/workspace'
          className={buttonClasses({
            className:
              'h-11 self-start rounded-xl px-[18px] text-[15px] text-[#334155] no-underline',
          })}
        >
          Go to library
        </Link>
      </section>
    )
  }

  const emails = (user?.emailAddresses ?? []).map((e) =>
    e.emailAddress.toLowerCase()
  )
  const signedInAs =
    user?.primaryEmailAddress?.emailAddress ?? emails[0] ?? 'your account'
  const matches = emails.includes(invite.email.toLowerCase())
  const inviter = invite.invitedByName ?? 'Someone'
  const roleName = invite.role === 'editor' ? 'Editor' : 'Viewer'
  const article = invite.role === 'editor' ? 'an' : 'a'

  /* ── State B: email mismatch ────────────────────────────────── */
  if (!matches) {
    return wrap(
      <section
        aria-labelledby='wrong-h'
        data-testid='jr-invite-state-mismatch'
        className={CARD}
      >
        <IconTile tone='warning'>
          <MailQuestion size={26} />
        </IconTile>
        <div className='flex flex-col gap-2'>
          <h2 id='wrong-h' className={HEADING}>
            This invite is for a different email
          </h2>
          <p className={LEAD}>
            The invite to{' '}
            <strong className='font-semibold text-[var(--jr-text)]'>
              {invite.projectName}
            </strong>{' '}
            was sent to{' '}
            <strong className='font-semibold text-[var(--jr-text)]'>
              {invite.email}
            </strong>
            , but you’re signed in as{' '}
            <strong className='font-semibold text-[var(--jr-text)]'>
              {signedInAs}
            </strong>
            .
          </p>
        </div>
        <div className='rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3.5 text-[13px] leading-normal text-[#9a3412]'>
          Invites are tied to the email they were sent to. Switch accounts, or
          ask {inviter} to invite {signedInAs} instead.
        </div>
        <div className='flex gap-2.5 max-sm:flex-col'>
          <Button
            className='h-11 flex-1 rounded-xl border-0 bg-[var(--jr-text)] text-[15px] text-white hover:bg-[#1e293b]'
            onClick={() => void signOut({ redirectUrl: returnUrl })}
            data-testid='jr-switch-account'
          >
            Switch account
          </Button>
          <Link
            href='/workspace'
            className={buttonClasses({
              className:
                'h-11 rounded-xl px-[18px] text-[15px] text-[#334155] no-underline',
            })}
          >
            Go to library
          </Link>
        </div>
      </section>
    )
  }

  /* ── State A: email matches ─────────────────────────────────── */
  const expiry = expiresIn(invite.expiresAt)
  const summary = [
    invite.projectName,
    invite.projectFileCount != null
      ? pluralize(invite.projectFileCount, 'file')
      : null,
    invite.projectMemberCount != null
      ? pluralize(invite.projectMemberCount, 'member')
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return wrap(
    <section
      aria-labelledby='accept-h'
      data-testid='jr-invite-state-match'
      className={CARD}
    >
      <IconTile>
        <UserPlus size={26} />
      </IconTile>
      <div className='flex flex-col gap-2'>
        <h1 id='accept-h' className={HEADING}>
          You’re invited to join{' '}
          <span className='text-[var(--jr-accent-hover)]'>
            {invite.projectName}
          </span>
        </h1>
        <p className={LEAD}>
          <strong className='font-semibold text-[var(--jr-text)]'>
            {inviter}
          </strong>{' '}
          invited you as {article}{' '}
          <strong className='font-semibold text-[var(--jr-text)]'>
            {roleName}
          </strong>
          . You’ll be able to {ROLE_COPY[invite.role]}.
        </p>
      </div>

      <dl className='m-0 flex flex-col gap-2.5 rounded-xl border border-[var(--jr-border)] bg-[var(--jr-bg)] px-4 py-3.5 text-[13px]'>
        <Row label='Project' value={summary} />
        <Row label='Invited' value={invite.email} />
        <Row
          label='Signed in as'
          value={
            <span className='inline-flex items-center gap-1.5 text-[var(--jr-accent-hover)]'>
              <CheckCircle2 size={14} />
              {signedInAs}
            </span>
          }
        />
        {expiry && <Row label='Expires' value={expiry} />}
      </dl>

      {error && (
        <p role='alert' className='m-0 text-sm text-[var(--jr-danger)]'>
          {error}
        </p>
      )}

      <div className='flex gap-2.5 max-sm:flex-col'>
        <Button
          variant='primary'
          className='h-11 flex-1 rounded-xl text-[15px]'
          disabled={busy}
          onClick={() => void accept()}
          data-testid='invite-accept'
        >
          Accept and open project
        </Button>
        <Button
          className='h-11 rounded-xl px-[18px] text-[15px] text-[#334155]'
          disabled={busy}
          onClick={() => void decline()}
          data-testid='invite-decline'
        >
          Decline
        </Button>
      </div>
      <p className='m-0 text-xs leading-normal text-[var(--jr-muted)]'>
        Accepting unlocks the project’s files for your account. Content stays
        end-to-end encrypted; only the project name, titles and membership are
        visible to the server.
      </p>
    </section>
  )
}

function IconTile({
  children,
  tone = 'accent',
}: {
  children: React.ReactNode
  tone?: 'accent' | 'warning'
}) {
  return (
    <div
      className={
        tone === 'warning'
          ? 'flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff7ed] text-[#c2410c]'
          : 'flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--jr-accent-soft)] text-[var(--jr-accent-hover)]'
      }
    >
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex justify-between gap-3'>
      <dt className='text-[var(--jr-muted)]'>{label}</dt>
      <dd className='m-0 text-right font-semibold'>{value}</dd>
    </div>
  )
}
