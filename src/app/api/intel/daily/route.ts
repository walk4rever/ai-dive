import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAuthor } from '@/lib/api-auth'

interface Signal {
  n: string
  source: string
  title: string
  desc: string
  url: string
}

interface IntelPayload {
  date: string
  overview: string
  keywords: string[]
  signals: Signal[]
  image_url?: string
}

export async function POST(req: NextRequest) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: IntelPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { date, overview, keywords, signals, image_url } = body

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Field "date" must be YYYY-MM-DD' }, { status: 422 })
  }
  if (!overview || typeof overview !== 'string') {
    return NextResponse.json({ error: 'Field "overview" is required' }, { status: 422 })
  }
  if (!Array.isArray(keywords)) {
    return NextResponse.json({ error: 'Field "keywords" must be an array' }, { status: 422 })
  }
  if (!Array.isArray(signals) || signals.length === 0) {
    return NextResponse.json({ error: 'Field "signals" must be a non-empty array' }, { status: 422 })
  }

  const slug = `intel-${date}`
  const content = JSON.stringify({
    keywords,
    signals,
    image_url: image_url ?? null,
  })

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_stories').upsert(
    {
      slug,
      title: `${date} AI 情报`,
      excerpt: overview.trim(),
      content,
      content_type: 'intel',
      status: 'published',
      published_at: new Date(date).toISOString(),
      author_slug: author.authorSlug,
    },
    { onConflict: 'slug' }
  )

  if (error) {
    console.error('[api/intel/daily] upsert failed', { slug, message: error.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  revalidatePath('/intel')
  revalidatePath('/')

  return NextResponse.json({ ok: true, slug }, { status: 200 })
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}
