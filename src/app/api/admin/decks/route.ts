import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { fetchAdminDecks } from '@/lib/admin/decks'

export async function GET() {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const decks = await fetchAdminDecks(supabase)

  return NextResponse.json({ decks })
}
