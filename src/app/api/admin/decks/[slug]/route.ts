import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { InvalidPriceError, parsePriceYuanToCents } from '@/lib/decks/access'

interface RouteParams {
  params: Promise<{ slug: string }>
}

const KICKERS = ['KEYNOTE', 'COURSE', 'REPORT', 'PLAYBOOK']

/** Metadata only — never `href` or `slug`. Both are the R2 content path's identity;
 *  editing them here without touching R2 would silently break the content proxy
 *  route (src/app/(site)/decks/[slug]/[...path]/route.ts), which resolves purely by
 *  slug. Content changes stay a scripts/import-deck.mjs job. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const allowed = ['title', 'kicker', 'description', 'meta', 'date', 'status']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  for (const key of ['title', 'description', 'meta'] as const) {
    if (key in body && (typeof body[key] !== 'string' || !body[key].trim())) {
      return NextResponse.json({ error: `${key} is required` }, { status: 422 })
    }
  }

  if ('kicker' in body && !KICKERS.includes(body.kicker)) {
    return NextResponse.json({ error: `kicker must be one of ${KICKERS.join(', ')}` }, { status: 422 })
  }

  if ('status' in body && !['draft', 'published'].includes(body.status)) {
    return NextResponse.json({ error: 'Status must be draft or published' }, { status: 422 })
  }

  if ('date' in body && (typeof body.date !== 'string' || Number.isNaN(Date.parse(body.date)))) {
    return NextResponse.json({ error: 'date must be a valid date' }, { status: 422 })
  }

  // Price is submitted as whole yuan (matching --price on import-deck.mjs); 0 or blank
  // both mean "not for sale" and are stored as NULL, never as a literal 0 — see
  // parsePriceYuanToCents in src/lib/decks/access.ts.
  if ('price' in body) {
    try {
      update.price_cents = parsePriceYuanToCents(body.price)
    } catch (err) {
      if (err instanceof InvalidPriceError) {
        return NextResponse.json({ error: err.message }, { status: 422 })
      }
      throw err
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_decks').update(update).eq('slug', slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/decks')

  return NextResponse.json({ ok: true })
}
