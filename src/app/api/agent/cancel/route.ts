import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveArticleSlug } from '@/lib/resolve-article-slug'

const GATEWAY_URL = process.env.AI_DIVE_AGENT_GATEWAY_URL
const AGENT_SECRET = process.env.AI_DIVE_AGENT_SECRET

// Explicit cancel signal for the stop button. /api/agent's own request-cancellation
// (aborting the upstream fetch on client disconnect) only works where the route
// actually runs as a long-lived process — on Vercel's Node.js serverless runtime, a
// client disconnect never reaches a running function invocation, so that path alone
// leaves the gateway session locked until the orphaned generation finishes on its own.
export async function POST(req: NextRequest) {
  if (!GATEWAY_URL || !AGENT_SECRET) {
    return NextResponse.json({ error: 'Agent not configured' }, { status: 503 })
  }

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.userId || typeof body.userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const articleSlug = await resolveArticleSlug(body.articleSlug)

  await fetch(`${GATEWAY_URL}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': AGENT_SECRET,
    },
    body: JSON.stringify({ userId: body.userId, articleSlug }),
  }).catch(() => {
    // Best-effort — worst case the session stays locked until the orphaned
    // generation finishes naturally, same as before this endpoint existed.
  })

  return NextResponse.json({ ok: true })
}
