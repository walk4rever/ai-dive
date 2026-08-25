import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { validateImageAttachments } from '@/lib/image-attachment'
import { authOptions } from '@/lib/auth'
import { deriveContextKey, fetchRecentTurns } from '@/lib/agent-context'
import { resolveArticleSlug } from '@/lib/resolve-article-slug'

export const maxDuration = 90

const GATEWAY_URL = process.env.AI_DIVE_AGENT_GATEWAY_URL
const AGENT_SECRET = process.env.AI_DIVE_AGENT_SECRET
const IMAGE_ONLY_PLACEHOLDER = '[用户发送了一张图片]'

export async function POST(req: NextRequest) {
  if (!GATEWAY_URL || !AGENT_SECRET) {
    return NextResponse.json({ error: 'Agent not configured' }, { status: 503 })
  }

  const session = await getServerSession(authOptions)
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
  const recentTurns = await fetchRecentTurns(supabaseService, session.user.id, contextKey)

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

  // req.signal alone reflects the browser disconnecting (stop button, tab close);
  // without also wiring it here, this route just keeps running the upstream
  // gateway call to completion in the background even after the client is gone,
  // leaving the gateway session's busy lock held until that orphaned call finishes.
  const upstream = await fetch(`${GATEWAY_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': AGENT_SECRET,
    },
    body: JSON.stringify({ message: body.message, userId: body.userId, articleSlug, images, history }),
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(85_000)]),
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
