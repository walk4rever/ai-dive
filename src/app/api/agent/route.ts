import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 90

const GATEWAY_URL = process.env.AI_DIVE_AGENT_GATEWAY_URL
const AGENT_SECRET = process.env.AI_DIVE_AGENT_SECRET

async function resolveArticleSlug(candidate: unknown): Promise<string | undefined> {
  if (typeof candidate !== 'string' || !candidate) return undefined

  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_pulse_stories')
    .select('slug')
    .eq('slug', candidate)
    .eq('status', 'published')
    .eq('is_premium', false)
    .single()

  return data?.slug
}

export async function POST(req: Request) {
  if (!GATEWAY_URL || !AGENT_SECRET) {
    return NextResponse.json({ error: 'Agent not configured' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const articleSlug = await resolveArticleSlug(body.articleSlug)

  const upstream = await fetch(`${GATEWAY_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': AGENT_SECRET,
    },
    body: JSON.stringify({ message: body.message, userId: body.userId, articleSlug }),
    signal: AbortSignal.timeout(85_000),
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    return NextResponse.json(
      { error: err || `Gateway error ${upstream.status}` },
      { status: upstream.status }
    )
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
