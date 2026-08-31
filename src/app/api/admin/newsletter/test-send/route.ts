import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getResend } from '@/lib/resend'
import { buildUnsubscribeUrl } from '@/lib/subscription/links'
import { fetchWeeklyDigestData, buildWeeklyDigestHtml, buildWeeklyDigestText, weeklyDigestSubject } from '@/lib/subscription/weekly-digest'

/** Sends one preview copy to an arbitrary address — no issue row, no send-log entry,
 *  can be run as many times as needed while drafting the summary. Real distribution
 *  (to every active subscriber, with dedup) is POST /api/admin/newsletter/send. */
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
  const to = typeof body?.to === 'string' ? body.to.trim() : ''
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : ''
  if (!to) return NextResponse.json({ error: 'to is required' }, { status: 422 })
  if (!summary) return NextResponse.json({ error: 'summary is required' }, { status: 422 })

  const supabase = await createServiceClient()
  const data = await fetchWeeklyDigestData(supabase)

  // Only a real subscriber has an id to sign an unsubscribe link with — an arbitrary
  // test address falls back to /subscribe in the template rather than a broken link.
  const { data: subscriber } = await supabase
    .from('ai_pulse_subscribers')
    .select('id')
    .eq('email', to)
    .maybeSingle()

  const unsubscribeUrl = subscriber
    ? buildUnsubscribeUrl({ email: to, subscriberId: subscriber.id, secret: confirmationSecret, siteUrl })
    : undefined

  const html = buildWeeklyDigestHtml({ data, summary, siteUrl, unsubscribeUrl })
  const text = buildWeeklyDigestText({ data, summary, siteUrl, unsubscribeUrl })

  const result = await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to,
    subject: `[测试] ${weeklyDigestSubject(data)}`,
    html,
    text,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
