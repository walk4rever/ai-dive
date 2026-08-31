import type { SupabaseClient } from '@supabase/supabase-js'

export interface DeckPricing {
  title: string
  priceCents: number | null
  currency: string
}

/** NULL price_cents means the deck was never priced — still free to read, no login
 *  required. Returns null when the slug doesn't resolve to a published deck at all.
 *  Carries `title` too (not just pricing) because the checkout flow needs a
 *  human-readable product name and this is already the one query that resolves a
 *  slug to its deck row — no reason for a second lookup. */
export async function getDeckPricing(supabase: SupabaseClient, slug: string): Promise<DeckPricing | null> {
  const { data, error } = await supabase
    .from('ai_pulse_decks')
    .select('title, price_cents, currency')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !data) return null

  return {
    title: data.title as string,
    priceCents: data.price_cents as number | null,
    currency: data.currency as string,
  }
}

export async function hasPaidDeckOrder(supabase: SupabaseClient, userId: string, slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ai_pulse_orders')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'deck')
    .eq('ref', slug)
    .eq('status', 'paid')
    .limit(1)

  if (error || !data) return false

  return data.length > 0
}

/** Single decision point for "can this request see this deck's content" — used by
 *  both the content proxy route and the detail page, so they can never disagree.
 *  `isAdmin` (from the session's role claim) skips the entitlement lookup entirely:
 *  the people who publish the decks shouldn't have to buy them to check them. The
 *  deck still has to resolve to a published row, so admins get a bypass on payment,
 *  not on existence. */
export async function canAccessDeck(
  supabase: SupabaseClient,
  userId: string | null,
  slug: string,
  { isAdmin = false }: { isAdmin?: boolean } = {}
): Promise<boolean> {
  const pricing = await getDeckPricing(supabase, slug)
  if (!pricing) return false
  if (pricing.priceCents === null) return true
  if (isAdmin) return true
  if (!userId) return false

  return hasPaidDeckOrder(supabase, userId, slug)
}

/** Formats a price in minor units (分) as a display string, e.g. 1900 CNY -> "¥19",
 *  1950 CNY -> "¥19.50". Only currency actually in use today is CNY; anything else
 *  falls back to a plain "<CODE> <amount>" so it doesn't silently mislabel a price. */
export function formatPrice(priceCents: number, currency: string): string {
  const amount = priceCents / 100
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
  return currency === 'CNY' ? `¥${formatted}` : `${currency} ${formatted}`
}
