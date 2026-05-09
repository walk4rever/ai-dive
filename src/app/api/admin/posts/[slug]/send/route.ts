import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { buildPostEmailHtml } from '@/lib/subscription/email'

const resend = new Resend(process.env.RESEND_API_KEY)

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const siteUrl = req.nextUrl.origin
  const confirmationSecret = process.env.EMAIL_CONFIRMATION_SECRET
  if (!siteUrl || !confirmationSecret) {
    return NextResponse.json({ error: 'Missing email configuration' }, { status: 500 })
  }

  const { slug } = await params
  const supabase = await createServiceClient()

  const { data: post, error: postError } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, excerpt, status')
    .eq('slug', slug)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status !== 'published') {
    return NextResponse.json({ error: 'Only published posts can be sent' }, { status: 409 })
  }

  const { data: subscribers, error: subscriberError } = await supabase
    .from('ai_pulse_subscribers')
    .select('id, email, name, status, confirmed_at, unsubscribed_at')
    .or('status.eq.active,and(confirmed_at.not.is.null,unsubscribed_at.is.null)')

  if (subscriberError) {
    return NextResponse.json({ error: 'Failed to load subscribers' }, { status: 500 })
  }

  const activeSubscribers = (subscribers ?? []) as Array<{
    id: string
    email: string
    name: string | null
    status: string
    confirmed_at: string | null
    unsubscribed_at: string | null
  }>

  if (activeSubscribers.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: 0,
      failed: 0,
      failures: [],
      message: 'No active subscribers',
    })
  }

  const { data: previousSends, error: sendLogError } = await supabase
    .from('ai_pulse_email_sends')
    .select('subscriber_id')
    .eq('story_id', post.id)

  if (sendLogError) {
    return NextResponse.json({ error: 'Failed to load send log' }, { status: 500 })
  }

  const sentSubscriberIds = new Set((previousSends ?? []).map((row: { subscriber_id: string }) => row.subscriber_id))
  const pendingRecipients = activeSubscribers.filter((subscriber) => !sentSubscriberIds.has(subscriber.id))

  let sent = 0
  const skipped = activeSubscribers.length - pendingRecipients.length
  const failures: string[] = []

  for (const subscriber of pendingRecipients) {
    const html = buildPostEmailHtml({
      post,
      recipient: subscriber,
      siteUrl,
      secret: confirmationSecret,
    })

    const result = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: subscriber.email,
      subject: post.title,
      html,
    })

    if (result.error) {
      failures.push(`${subscriber.email}: ${result.error.message}`)
      continue
    }

    const { error } = await supabase
      .from('ai_pulse_email_sends')
      .insert({
        story_id: post.id,
        subscriber_id: subscriber.id,
      })

    if (error) {
      failures.push(`${subscriber.email}: failed to log send`)
      continue
    }

    sent += 1
  }

  return NextResponse.json({
    ok: failures.length === 0,
    sent,
    skipped,
    failed: failures.length,
    failures,
  })
}
