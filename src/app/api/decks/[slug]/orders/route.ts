import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createDeckOrder, DeckOrderError } from '@/lib/decks/orders'

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.user.email) {
    return NextResponse.json({ error: 'Account has no email on file' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const method = body?.method
  if (method !== 'alipay' && method !== 'wechat') {
    return NextResponse.json({ error: 'method must be "alipay" or "wechat"' }, { status: 400 })
  }

  const origin = req.nextUrl.origin
  const supabase = await createServiceClient()

  try {
    const result = await createDeckOrder(
      supabase,
      session.user.id,
      session.user.email,
      slug,
      method,
      origin
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof DeckOrderError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
