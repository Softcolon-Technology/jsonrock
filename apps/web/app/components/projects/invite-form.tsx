'use client'

import { useId, useState } from 'react'
import { Button } from '../ui/button'
import { RoleSelect } from '../ui/role-select'
import type { InviteRole } from '@/types/library'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface InviteFormProps {
  onInvite: (email: string, role: InviteRole) => Promise<void>
}

export function InviteForm({ onInvite }: InviteFormProps) {
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const trimmed = email.trim().toLowerCase()
  const emailValid = EMAIL_RE.test(trimmed)
  const canSubmit = emailValid && !busy

  const submit = async () => {
    setTouched(true)
    setSent(null)
    if (!emailValid) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onInvite(trimmed, role)
      setEmail('')
      setTouched(false)
      setSent(trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      data-testid='invite-form'
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className='flex flex-col gap-2.5 border-b border-[var(--jr-border)] bg-[var(--jr-bg)] p-4'
    >
      <label htmlFor={emailId} className='text-xs font-semibold text-[#334155]'>
        Invite by email
      </label>
      <div className='flex gap-2'>
        <input
          id={emailId}
          type='email'
          placeholder='name@company.com'
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          onBlur={() => setTouched(true)}
          data-testid='jr-invite-email'
          className='h-[38px] min-w-0 flex-1 rounded-[10px] border border-[var(--jr-border)] bg-[var(--jr-surface)] px-3 text-sm text-[var(--jr-text)] outline-none focus:border-[var(--jr-accent)]'
        />
        <RoleSelect
          size='md'
          label='Role'
          value={role}
          onChange={(v) => v !== 'remove' && setRole(v)}
          testId='jr-invite-role'
        />
      </div>
      <Button
        type='submit'
        variant='primary'
        disabled={!canSubmit}
        className='h-[38px] w-full'
        data-testid='jr-invite-send'
      >
        {busy ? 'Sending…' : 'Send invite'}
      </Button>
      {(error || (touched && email.length > 0 && !emailValid)) && (
        <p role='alert' className='m-0 text-xs text-[var(--jr-danger)]'>
          {error || 'Enter a valid email address'}
        </p>
      )}
      {sent && (
        <p role='status' className='m-0 text-xs text-[var(--jr-accent-hover)]'>
          Invite sent to {sent}.
        </p>
      )}
      {/* <p className='m-0 text-xs leading-normal text-[var(--jr-muted)]'>
        They get an email. If they are signed in right now, they also see a live
        Accept / Decline prompt in the app.
      </p> */}
    </form>
  )
}
