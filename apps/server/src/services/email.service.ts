import { createClerkClient } from '@clerk/backend'
import { Resend } from 'resend'
import logger from '../config/logger'

/** Published Resend template aliases. */
export const DOCUMENT_SHARE_TEMPLATE_ID = 'document-share'
export const WELCOME_EMAIL_TEMPLATE_ID = 'welcome-email'

export interface ShareEmailPayload {
  recipientEmail: string
  shareUrl: string
  documentTitle: string
  /** Clerk user id of the authenticated sender — used to resolve senderName. */
  senderUserId: string
}

export interface WelcomeEmailPayload {
  recipientEmail: string
  firstName: string
}

/**
 * Resolve a human-readable display name for the authenticated Clerk user.
 */
export async function resolveClerkSenderName(userId: string): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    return 'Someone'
  }

  try {
    const clerk = createClerkClient({ secretKey })
    const user = await clerk.users.getUser(userId)
    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()
    if (fullName) return fullName
    if (user.username) return user.username
    const primaryEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress || user.emailAddresses[0]?.emailAddress
    if (primaryEmail) return primaryEmail
  } catch (error) {
    logger.warn('[share-email] Failed to resolve Clerk sender name', error)
  }

  return 'Someone'
}

/**
 * Derive a firstName for the welcome-email template merge tag.
 */
export function resolveWelcomeFirstName(input: {
  firstName?: string | null
  email?: string
}): string {
  const trimmed = input.firstName?.trim()
  if (trimmed) return trimmed

  const localPart = input.email?.split('@')[0]?.trim()
  if (localPart) return localPart

  return 'there'
}

/**
 * Sends a share-link email via Resend using the published "document-share" template.
 * Merge tags: senderName, documentTitle, shareUrl.
 */
export async function sendShareLinkEmail(
  payload: ShareEmailPayload
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not configured. Add it to the server environment.'
    )
  }

  const from =
    process.env.RESEND_FROM_EMAIL || 'JsonRock <noreply@jsonrock.com>'

  const senderName = await resolveClerkSenderName(payload.senderUserId)
  const documentTitle = payload.documentTitle.trim() || 'Untitled document'

  const resend = new Resend(apiKey)

  // Resend requires `subject` when the published template has no default subject.
  const subject = `${senderName} shared "${documentTitle}" with you`

  const { data, error } = await resend.emails.send({
    from,
    to: payload.recipientEmail,
    subject,
    template: {
      id: DOCUMENT_SHARE_TEMPLATE_ID,
      variables: {
        senderName,
        documentTitle,
        shareUrl: payload.shareUrl,
      },
    },
  })

  if (error) {
    logger.error('[share-email] Resend template send error', error)
    throw new Error(error.message || 'Failed to send email')
  }

  if (!data?.id) {
    throw new Error('Resend did not return an email id')
  }

  logger.info('[share-email] Sent document-share template', {
    id: data.id,
    to: payload.recipientEmail,
    documentTitle,
    senderName,
  })

  return { id: data.id }
}

export interface ProjectInviteEmailPayload {
  recipientEmail: string
  projectName: string
  inviterName: string
  role: 'editor' | 'viewer'
  acceptUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sends a project invitation email via Resend (inline HTML, no template).
 * Returns null (and logs a warning) when RESEND_API_KEY is not configured so
 * invite creation never fails because of email delivery.
 */
export async function sendProjectInviteEmail(
  payload: ProjectInviteEmailPayload
): Promise<{ id: string } | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.warn(
      '[project-invite-email] RESEND_API_KEY is not configured; skipping email',
      { to: payload.recipientEmail }
    )
    return null
  }

  const from =
    process.env.RESEND_FROM_EMAIL || 'JsonRock <noreply@jsonrock.com>'
  const inviter = escapeHtml(payload.inviterName)
  const project = escapeHtml(payload.projectName)
  const roleLabel = payload.role === 'editor' ? 'edit' : 'view'
  const url = escapeHtml(payload.acceptUrl)

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;margin:0 0 16px;">You're invited to a project</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">
        <strong>${inviter}</strong> invited you to <strong>${project}</strong> on JsonRock
        with permission to <strong>${roleLabel}</strong> its files.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;">View invitation</a>
      </p>
      <p style="font-size:13px;color:#71717a;line-height:1.5;margin:0;">
        Sign in with this email address to accept. The invitation expires in 14 days.<br />
        If the button doesn't work, paste this link into your browser:<br />
        <span style="word-break:break-all;">${url}</span>
      </p>
    </div>
  </body>
</html>`

  const text = `${payload.inviterName} invited you to "${payload.projectName}" on JsonRock (you can ${roleLabel} its files).\n\nAccept the invitation: ${payload.acceptUrl}\n\nSign in with this email address to accept. The invitation expires in 14 days.`

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from,
    to: payload.recipientEmail,
    subject: `${payload.inviterName} invited you to "${payload.projectName}" on JsonRock`,
    html,
    text,
  })

  if (error) {
    logger.error('[project-invite-email] Resend send error', error)
    throw new Error(error.message || 'Failed to send invite email')
  }

  if (!data?.id) {
    throw new Error('Resend did not return an email id')
  }

  logger.info('[project-invite-email] Sent project invite', {
    id: data.id,
    to: payload.recipientEmail,
  })
  return { id: data.id }
}

/**
 * Sends the first-time signup welcome email via Resend "welcome-email" template.
 * Merge tags: firstName.
 */
export async function sendWelcomeEmail(
  payload: WelcomeEmailPayload
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not configured. Add it to the server environment.'
    )
  }

  const from =
    process.env.RESEND_FROM_EMAIL || 'JsonRock <noreply@jsonrock.com>'

  const firstName = payload.firstName.trim() || 'there'
  const resend = new Resend(apiKey)

  const { data, error } = await resend.emails.send({
    from,
    to: payload.recipientEmail,
    subject: `Welcome to JsonRock, ${firstName}`,
    template: {
      id: WELCOME_EMAIL_TEMPLATE_ID,
      variables: {
        firstName,
      },
    },
  })

  if (error) {
    logger.error('[welcome-email] Resend template send error', error)
    throw new Error(error.message || 'Failed to send welcome email')
  }

  if (!data?.id) {
    throw new Error('Resend did not return an email id')
  }

  logger.info('[welcome-email] Sent welcome-email template', {
    id: data.id,
    to: payload.recipientEmail,
    firstName,
  })

  return { id: data.id }
}
