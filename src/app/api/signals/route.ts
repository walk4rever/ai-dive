import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAuthor } from '@/lib/api-auth'

const VALID_STATUS = new Set(['raw', 'selected', 'archived'])

interface SignalInput {
  url: string
  source_type: string
  source_name?: string | null
  title: string
  description?: string | null
  date: string
  status?: string
  metadata?: Record<string, unknown> | null
  reason?: string | null
  insight?: number | null
  actionable?: number | null
  influence?: number | null
}

function validateSignal(s: SignalInput, index?: number): string | null {
  const prefix = index !== undefined ? `signals[${index}]: ` : ''
  if (!s.url || typeof s.url !== 'string') return `${prefix}field "url" is required`
  if (!s.source_type || typeof s.source_type !== 'string') return `${prefix}field "source_type" is required`
  if (!s.title || typeof s.title !== 'string') return `${prefix}field "title" is required`
  if (!s.date || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return `${prefix}field "date" must be YYYY-MM-DD`
  if (s.status && !VALID_STATUS.has(s.status)) return `${prefix}field "status" must be raw | selected | archived`
  for (const dim of ['insight', 'actionable', 'influence'] as const) {
    const v = s[dim]
    if (v !== undefined && v !== null && (typeof v !== 'number' || v < 0 || v > 10 || !Number.isInteger(v))) {
      return `${prefix}field "${dim}" must be an integer 0-10`
    }
  }
  return null
}

function toRow(s: SignalInput) {
  return {
    url: s.url.trim(),
    source_type: s.source_type.trim(),
    source_name: s.source_name ?? null,
    title: s.title.trim(),
    description: s.description ?? null,
    date: s.date,
    status: VALID_STATUS.has(s.status ?? '') ? s.status! : 'raw',
    metadata: s.metadata ?? null,
    reason: s.reason ?? null,
    insight: s.insight ?? null,
    actionable: s.actionable ?? null,
    influence: s.influence ?? null,
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

  if (inputs.length === 0) {
    return NextResponse.json({ error: 'No signals provided' }, { status: 422 })
  }
  if (inputs.length > 100) {
    return NextResponse.json({ error: 'Batch limit is 100 signals per request' }, { status: 422 })
  }

  for (let i = 0; i < inputs.length; i++) {
    const err = validateSignal(inputs[i], inputs.length > 1 ? i : undefined)
    if (err) return NextResponse.json({ error: err }, { status: 422 })
  }

  const rows = inputs.map(toRow)
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('ai_pulse_signals')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })

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
