import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { syncOrderForUser } from '@/lib/payments/sync'

/** Alipay sends the browser back here after checkout. Reconcile before landing on
 *  the deck list so a delayed async notification does not show a paid user the buy
 *  button again. Failures are ignored: the signed callback can still settle it. */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order')

  if (orderId) {
    try {
      const session = await getServerSession(authOptions)
      if (session?.user.id) {
        const supabase = await createServiceClient()
        await syncOrderForUser(supabase, session.user.id, orderId)
      }
    } catch {
      // Best effort — the provider callback remains the authoritative path.
    }
  }

  return NextResponse.redirect(new URL('/decks', req.nextUrl.origin), 303)
}
