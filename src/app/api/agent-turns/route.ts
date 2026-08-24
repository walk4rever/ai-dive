import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { authOptions } from '@/lib/auth'
import { deriveContextKey, fetchRecentTurns } from '@/lib/agent-context'
import { validateImageAttachments } from '@/lib/image-attachment'
import { uploadBase64ToR2 } from '@/lib/r2'

const MAX_TEXT_LENGTH = 8000

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contextKey = deriveContextKey(req.nextUrl.searchParams.get('contextKey'))
  const supabase = await createServiceClient()
  const turns = await fetchRecentTurns(supabase, session.user.id, contextKey)

  return NextResponse.json({ turns })
}

interface PostBody {
  contextKey?: unknown
  role?: unknown
  text?: unknown
  images?: unknown
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as PostBody | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const { role, text: rawText } = body

  if (role !== 'user' && role !== 'assistant') {
    return NextResponse.json({ error: 'role must be "user" or "assistant"' }, { status: 422 })
  }

  const text = typeof rawText === 'string' ? rawText.trim() : ''
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'text too long' }, { status: 422 })
  }

  let images
  try {
    images = validateImageAttachments(body.images)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'invalid images' }, { status: 400 })
  }

  // A turn must carry something — but text-empty is valid as long as there are
  // images (a pure-image message), matching the client's own send gate.
  if (!text && (!images || images.length === 0)) {
    return NextResponse.json({ error: 'text or images is required' }, { status: 422 })
  }

  const contextKey = deriveContextKey(typeof body.contextKey === 'string' ? body.contextKey : undefined)

  const imageUrls = images
    ? await Promise.all(images.map((image) => uploadBase64ToR2(session.user.id, 'chat', image)))
    : []

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_chat_turns').insert({
    user_id: session.user.id,
    context_key: contextKey,
    role,
    text,
    image_urls: imageUrls,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
