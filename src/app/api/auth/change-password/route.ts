import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { authOptions } from '@/lib/auth'
import { verifyPassword, hashPassword } from '@/lib/auth/password'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user

  let body: { current_password?: string; new_password?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { current_password, new_password } = body

  if (!current_password || !new_password) {
    return NextResponse.json({ error: 'current_password and new_password are required' }, { status: 422 })
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('ai_pulse_users')
    .select('password_hash')
    .eq('id', user.id)
    .single()

  if (!data || !verifyPassword(current_password, data.password_hash)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  const { error } = await supabase
    .from('ai_pulse_users')
    .update({ password_hash: hashPassword(new_password) })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
