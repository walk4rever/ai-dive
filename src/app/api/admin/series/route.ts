import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!await requireAdminSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('ai_pulse_topics')
    .select('id, name, description, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ series: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!await requireAdminSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''

  if (!name) {
    return NextResponse.json({ error: 'Field "name" is required' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('ai_pulse_topics')
    .insert({ name, description })
    .select('id, name, description, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Series name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ series: data }, { status: 201 })
}
