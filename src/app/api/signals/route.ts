import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAuthor } from '@/lib/api-auth'
import { getTodayYmd, parseYmd } from '@/lib/timezone'

type SourceType = 'x' | 'github' | 'arxiv' | 'a16z' | 'techcrunch' | 'ithome' | 'yc' | 'web'

function inferSourceType(url: string): SourceType {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === 'x.com' || host === 'twitter.com') return 'x'
    if (host === 'arxiv.org') return 'arxiv'
    if (host === 'github.com' || host === 'github.blog') return 'github'
    if (host === 'a16z.com') return 'a16z'
    if (host === 'techcrunch.com') return 'techcrunch'
    if (host === 'www.ithome.com') return 'ithome'
    if (host === 'news.ycombinator.com' || host === 'ycombinator.com') return 'yc'
  } catch {
    // invalid URL falls through to web
  }
  return 'web'
}

interface SignalInput {
  url: string
  source_channel?: string | null
  source_name?: string | null
  title: string
  description: string
  signal_date?: string
  metadata?: Record<string, unknown> | null
}

function validateSignal(s: SignalInput, index?: number): string | null {
  const p = index !== undefined ? `signals[${index}]: ` : ''

  if (!s.url || typeof s.url !== 'string' || !/^https?:\/\/.+/.test(s.url.trim()))
    return `${p}field "url" must be a valid URL`

  if (!s.title || typeof s.title !== 'string' || !s.title.trim())
    return `${p}field "title" is required`
  if (s.title.trim().length > 200)
    return `${p}field "title" must be ≤200 characters`

  if (!s.description || typeof s.description !== 'string' || !s.description.trim())
    return `${p}field "description" is required`
  const desc = s.description.trim()
  if (desc.length < 20)
    return `${p}field "description" must be ≥20 characters`
  if (desc.length > 500)
    return `${p}field "description" must be ≤500 characters`

  if (s.source_name !== undefined && s.source_name !== null && s.source_name.trim() === '')
    return `${p}field "source_name" must not be an empty string`

  if (s.source_channel !== undefined && s.source_channel !== null && s.source_channel.trim() === '')
    return `${p}field "source_channel" must not be an empty string`

  if (s.signal_date !== undefined) {
    if (!parseYmd(s.signal_date)) return `${p}field "signal_date" must be YYYY-MM-DD`
    const today = getTodayYmd()
    if (s.signal_date > today) return `${p}field "signal_date" must not be in the future`
  }

  const ogImage = s.metadata?.og_image
  if (ogImage !== undefined && ogImage !== null && (typeof ogImage !== 'string' || !ogImage.startsWith('https://')))
    return `${p}metadata.og_image must be a valid https:// URL`

  return null
}

function toRow(s: SignalInput, agentId: string) {
  return {
    url: s.url.trim(),
    source_type: inferSourceType(s.url.trim()),
    source_channel: s.source_channel?.trim() ?? null,
    source_name: s.source_name?.trim() ?? null,
    title: s.title.trim(),
    description: s.description.trim(),
    signal_date: s.signal_date ?? getTodayYmd(),
    status: 'enabled',
    metadata: s.metadata ?? null,
    agent_id: agentId,
  }
}

export async function GET(req: NextRequest) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author?.agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') ?? '60'), 100)
  const since = searchParams.get('since') // YYYY-MM-DD
  const insightMin = searchParams.get('insight_min') !== null ? Number(searchParams.get('insight_min')) : null
  const influenceMin = searchParams.get('influence_min') !== null ? Number(searchParams.get('influence_min')) : null

  if (since && !parseYmd(since)) {
    return NextResponse.json({ error: 'Field "since" must be YYYY-MM-DD' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  let query = supabase
    .from('ai_pulse_signals')
    .select('id, url, source_type, source_channel, source_name, title, description, signal_date, metadata, reason, insight, actionable, influence, score_status')
    .eq('status', 'enabled')
    .order('signal_date', { ascending: false })
    .order('insight', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (since) query = query.gte('signal_date', since)
  if (insightMin !== null) query = query.gte('insight', insightMin)
  else if (influenceMin !== null) query = query.gte('influence', influenceMin)

  const { data, error } = await query
  if (error) {
    console.error('[api/signals] GET failed', { message: error.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ signals: data, count: data?.length ?? 0 })
}

export async function POST(req: NextRequest) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author?.agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const inputs: SignalInput[] = Array.isArray(body) ? body : [body as SignalInput]

  if (inputs.length === 0)
    return NextResponse.json({ error: 'No signals provided' }, { status: 422 })
  if (inputs.length > 100)
    return NextResponse.json({ error: 'Batch limit is 100 signals per request' }, { status: 422 })

  for (let i = 0; i < inputs.length; i++) {
    const err = validateSignal(inputs[i], inputs.length > 1 ? i : undefined)
    if (err) return NextResponse.json({ error: err }, { status: 422 })
  }

  const rows = inputs.map(s => toRow(s, author.agentId!))
  const supabase = await createServiceClient()

  // Check ownership of existing signals before upserting
  const { data: existing, error: fetchError } = await supabase
    .from('ai_pulse_signals')
    .select('url, agent_id')
    .in('url', rows.map(r => r.url))

  if (fetchError) {
    console.error('[api/signals] fetch existing failed', { message: fetchError.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const ownerByUrl = new Map(existing?.map(r => [r.url, r.agent_id]) ?? [])
  const allowed = rows.filter(r => {
    const owner = ownerByUrl.get(r.url)
    return owner === undefined || owner === author.agentId
  })
  const skipped = rows.length - allowed.length

  if (allowed.length > 0) {
    const { error } = await supabase
      .from('ai_pulse_signals')
      .upsert(allowed, { onConflict: 'url', ignoreDuplicates: true })

    if (error) {
      console.error('[api/signals] upsert failed', { count: allowed.length, message: error.message })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
  }

  revalidatePath('/intels')
  revalidateTag('signal-calendar-days', { expire: 0 })

  return NextResponse.json({ ok: true, count: allowed.length, skipped }, { status: 200 })
}

export async function DELETE(req: NextRequest) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author?.agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const urls = (body as { urls?: unknown })?.urls
  if (!Array.isArray(urls) || urls.length === 0)
    return NextResponse.json({ error: '"urls" must be a non-empty array' }, { status: 422 })
  if (urls.length > 100)
    return NextResponse.json({ error: 'Batch limit is 100 URLs per request' }, { status: 422 })
  for (const url of urls) {
    if (typeof url !== 'string' || !url.trim())
      return NextResponse.json({ error: `Invalid URL: ${String(url)}` }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('ai_pulse_signals')
    .delete()
    .in('url', urls)
    .eq('agent_id', author.agentId)
    .select('url')

  if (error) {
    console.error('[api/signals] delete failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  revalidatePath('/intels')
  revalidateTag('signal-calendar-days', { expire: 0 })

  return NextResponse.json({ ok: true, deleted: data?.length ?? 0 })
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}
