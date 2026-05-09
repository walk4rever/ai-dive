import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAuthor } from '@/lib/api-auth'

const VALID_STATUS = new Set(['raw', 'selected', 'archived'])
const VALID_SOURCE_TYPES = new Set(['hn', 'github', 'arxiv', 'twitter', 'web'])

const RAW_TWEET_PATTERNS = [/🧵/, /【引用/, /更多内容详见/, /转推/, /Retweet/i]

interface SignalInput {
  url: string
  source_type: string
  source_name?: string | null
  title: string
  description: string
  date: string
  status?: string
  metadata?: Record<string, unknown> | null
}

function validateSignal(s: SignalInput, index?: number): string | null {
  const p = index !== undefined ? `signals[${index}]: ` : ''

  if (!s.url || typeof s.url !== 'string' || !s.url.trim().startsWith('https://'))
    return `${p}field "url" must be a valid https:// URL`

  if (!s.source_type || !VALID_SOURCE_TYPES.has(s.source_type))
    return `${p}field "source_type" must be one of: hn, github, arxiv, twitter, web`

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
  for (const pattern of RAW_TWEET_PATTERNS) {
    if (pattern.test(desc))
      return `${p}field "description" appears to contain raw tweet content — please provide a synthesized summary`
  }

  if (s.source_name !== undefined && s.source_name !== null && s.source_name.trim() === '')
    return `${p}field "source_name" must not be an empty string`

  if (!s.date || !/^\d{4}-\d{2}-\d{2}$/.test(s.date))
    return `${p}field "date" must be YYYY-MM-DD`
  const d = new Date(s.date)
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  if (d > now) return `${p}field "date" must not be in the future`
  if (d < ninetyDaysAgo) return `${p}field "date" must be within the last 90 days`

  if (s.status && !VALID_STATUS.has(s.status))
    return `${p}field "status" must be raw | selected | archived`

  const ogImage = s.metadata?.og_image
  if (ogImage !== undefined && ogImage !== null && (typeof ogImage !== 'string' || !ogImage.startsWith('https://')))
    return `${p}metadata.og_image must be a valid https:// URL`

  return null
}

function toRow(s: SignalInput) {
  return {
    url: s.url.trim(),
    source_type: s.source_type,
    source_name: s.source_name?.trim() ?? null,
    title: s.title.trim(),
    description: s.description.trim(),
    date: s.date,
    status: VALID_STATUS.has(s.status ?? '') ? s.status! : 'raw',
    metadata: s.metadata ?? null,
  }
}

export async function POST(req: NextRequest) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const rows = inputs.map(toRow)
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('ai_pulse_signals')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: false })

  if (error) {
    console.error('[api/signals] upsert failed', { count: rows.length, message: error.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  revalidatePath('/intel')

  return NextResponse.json({ ok: true, count: rows.length }, { status: 200 })
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}
