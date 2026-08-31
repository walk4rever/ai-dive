import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { fetchWeeklyDigestData, buildWeeklyDigestHtml } from '@/lib/subscription/weekly-digest'

/** Re-renders the digest HTML with whatever summary text the admin has typed so far —
 *  no unsubscribe link (there's no real recipient yet), no send, no DB write. */
export async function POST(req: NextRequest) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const summary = typeof body?.summary === 'string' ? body.summary : ''

  const supabase = await createServiceClient()
  const data = await fetchWeeklyDigestData(supabase)
  const html = buildWeeklyDigestHtml({ data, summary, siteUrl: req.nextUrl.origin })

  return NextResponse.json({ html })
}
