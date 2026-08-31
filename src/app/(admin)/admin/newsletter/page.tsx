import { createServiceClient } from '@/lib/supabase/server'
import { fetchWeeklyDigestData, buildWeeklyDigestHtml } from '@/lib/subscription/weekly-digest'
import { NewsletterManager } from './NewsletterManager'

export default async function AdminNewsletterPage() {
  const supabase = await createServiceClient()
  const data = await fetchWeeklyDigestData(supabase)

  const [{ data: existingIssue }, { count: subscriberCount }] = await Promise.all([
    supabase
      .from('ai_pulse_newsletter_issues')
      .select('id, summary, sent_at')
      .eq('period_start', data.periodStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ai_pulse_subscribers')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.active,and(confirmed_at.not.is.null,unsubscribed_at.is.null)'),
  ])

  const initialSummary = existingIssue?.summary ?? ''
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai.air7.fun'
  const initialHtml = buildWeeklyDigestHtml({ data, summary: initialSummary, siteUrl })

  return (
    <NewsletterManager
      periodLabel={`${data.periodStart} – ${data.periodEnd}`}
      signalCount={data.topSignals.length}
      postCount={data.recentPosts.length}
      deckCount={data.paidDecks.length}
      subscriberCount={subscriberCount ?? 0}
      initialSummary={initialSummary}
      alreadySentAt={existingIssue?.sent_at ?? null}
      initialHtml={initialHtml}
    />
  )
}
