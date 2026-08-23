import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateImageAttachments } from '@/lib/image-attachment'
import { resolveSession } from '@/lib/auth/session'
import { deriveContextKey, fetchRecentTurns } from '@/lib/agent-context'

export const maxDuration = 90

const GATEWAY_URL = process.env.AI_DIVE_AGENT_GATEWAY_URL
const AGENT_SECRET = process.env.AI_DIVE_AGENT_SECRET
const IMAGE_ONLY_PLACEHOLDER = '[用户发送了一张图片]'

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

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

export async function POST(req: NextRequest) {
  if (!GATEWAY_URL || !AGENT_SECRET) {
    return NextResponse.json({ error: 'Agent not configured' }, { status: 503 })
  }

  const session = await resolveSession(extractBearer(req))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  const trimmedMessage = body.message.trim()

  const articleSlug = await resolveArticleSlug(body.articleSlug)

  let images
  try {
    images = validateImageAttachments(body.images)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'invalid images' }, { status: 400 })
  }

  const contextKey = deriveContextKey(typeof body.articleSlug === 'string' ? body.articleSlug : undefined)
  const supabaseService = await createServiceClient()
  const recentTurns = await fetchRecentTurns(supabaseService, session.id, contextKey)

  // The client fire-and-forgets a persist call for this exact user message
  // concurrently with this request — the history query can race ahead and pick it
  // up. Drop a trailing duplicate so it isn't seeded into the session AND sent as
  // the live prompt.
  const lastTurn = recentTurns[recentTurns.length - 1]
  const dedupedTurns =
    lastTurn && lastTurn.role === 'user' && lastTurn.text === trimmedMessage
      ? recentTurns.slice(0, -1)
      : recentTurns

  const history = dedupedTurns.map((turn) => ({
    role: turn.role,
    text: turn.text || IMAGE_ONLY_PLACEHOLDER,
  }))

  const upstream = await fetch(`${GATEWAY_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': AGENT_SECRET,
    },
    body: JSON.stringify({ message: body.message, userId: body.userId, articleSlug, images, history }),
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
