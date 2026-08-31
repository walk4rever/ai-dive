import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getResend } from '@/lib/resend'
import { buildUnsubscribeUrl } from '@/lib/subscription/links'
import { fetchWeeklyDigestData, buildWeeklyDigestHtml, buildWeeklyDigestText, weeklyDigestSubject } from '@/lib/subscription/weekly-digest'

/** Sends this week's issue to every active subscriber. Reuses ai_pulse_email_sends
 *  for per-recipient dedup (story_id NULL, newsletter_issue_id set) — same shape the
 *  single-post send flow already relies on, see src/app/api/admin/posts/[slug]/send.
 *
 *  The issue row is found-or-created by period_start (today's computed 7-day window),
 *  not created fresh on every call: that's what makes a retry of this exact request
 *  land on the same issue_id, so the per-subscriber dedup below actually protects
 *  against double-sending on retry. Running this again tomorrow computes a different
 *  period_start and starts a new issue, as intended. */
export async function POST(req: NextRequest) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const siteUrl = req.nextUrl.origin
  const confirmationSecret = process.env.EMAIL_CONFIRMATION_SECRET
  const resend = getResend()
  if (!resend || !confirmationSecret) {
    return NextResponse.json({ error: 'Missing email configuration' }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : ''
  if (!summary) return NextResponse.json({ error: 'summary is required' }, { status: 422 })

  const supabase = await createServiceClient()
  const data = await fetchWeeklyDigestData(supabase)

  const { data: existingIssue, error: issueLookupError } = await supabase
    .from('ai_pulse_newsletter_issues')
    .select('id')
    .eq('period_start', data.periodStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (issueLookupError) {
    return NextResponse.json({ error: issueLookupError.message }, { status: 500 })
  }

  let issueId = existingIssue?.id as string | undefined
  if (issueId) {
    await supabase.from('ai_pulse_newsletter_issues').update({ summary }).eq('id', issueId)
  } else {
    const { data: created, error: createError } = await supabase
      .from('ai_pulse_newsletter_issues')
      .insert({ period_start: data.periodStart, period_end: data.periodEnd, summary })
      .select('id')
      .single()
    if (createError || !created) {
      return NextResponse.json({ error: createError?.message ?? 'Failed to create issue' }, { status: 500 })
    }
    issueId = created.id as string
  }

  const { data: subscribers, error: subscriberError } = await supabase
    .from('ai_pulse_subscribers')
    .select('id, email')
    .or('status.eq.active,and(confirmed_at.not.is.null,unsubscribed_at.is.null)')

  if (subscriberError) {
    return NextResponse.json({ error: 'Failed to load subscribers' }, { status: 500 })
  }

  const activeSubscribers = (subscribers ?? []) as Array<{ id: string; email: string }>
  if (activeSubscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, failed: 0, failures: [], message: 'No active subscribers' })
  }

  const { data: previousSends, error: sendLogError } = await supabase
    .from('ai_pulse_email_sends')
    .select('subscriber_id')
    .eq('newsletter_issue_id', issueId)

  if (sendLogError) {
    return NextResponse.json({ error: 'Failed to load send log' }, { status: 500 })
  }

  const sentSubscriberIds = new Set((previousSends ?? []).map((row: { subscriber_id: string }) => row.subscriber_id))
  const pendingRecipients = activeSubscribers.filter((s) => !sentSubscriberIds.has(s.id))

  let sent = 0
  const skipped = activeSubscribers.length - pendingRecipients.length
  const failures: string[] = []
  const subject = weeklyDigestSubject(data)

  for (const subscriber of pendingRecipients) {
    const unsubscribeUrl = buildUnsubscribeUrl({
      email: subscriber.email,
      subscriberId: subscriber.id,
      secret: confirmationSecret,
      siteUrl,
    })
    const html = buildWeeklyDigestHtml({ data, summary, siteUrl, unsubscribeUrl })
    const text = buildWeeklyDigestText({ data, summary, siteUrl, unsubscribeUrl })

    const result = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: subscriber.email,
      subject,
      html,
      text,
    })

    if (result.error) {
      failures.push(`${subscriber.email}: ${result.error.message}`)
      continue
    }

    const { error } = await supabase
      .from('ai_pulse_email_sends')
      .insert({ newsletter_issue_id: issueId, subscriber_id: subscriber.id })

    if (error) {
      failures.push(`${subscriber.email}: failed to log send`)
      continue
    }

    sent += 1
  }

  if (failures.length === 0) {
    await supabase.from('ai_pulse_newsletter_issues').update({ sent_at: new Date().toISOString() }).eq('id', issueId)
  }

  return NextResponse.json({ ok: failures.length === 0, sent, skipped, failed: failures.length, failures })
}
