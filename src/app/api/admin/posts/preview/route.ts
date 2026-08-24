import { NextRequest, NextResponse } from 'next/server'
import { markdownToHtml } from '@/lib/markdown'
import { requireAdminSession } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'Content is required' }, { status: 422 })
  }

  try {
    return NextResponse.json({ html: await markdownToHtml(body.content) })
  } catch {
    return NextResponse.json({ error: 'Failed to render markdown content' }, { status: 422 })
  }
}
