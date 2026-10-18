import type { SupabaseClient } from '@supabase/supabase-js'

export interface UserOrder {
  id: string
  /** Human-readable product name — the deck's own title when the ref still resolves,
   *  otherwise the raw ref so a purchase never renders as a blank row. */
  title: string
  /** Where to open the product, when it is still reachable and the order is paid. */
  href: string | null
  amountCents: number
  currency: string
  status: 'pending' | 'paid' | 'refunded' | 'cancelled' | 'unknown'
  createdAt: string
  paidAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
}

interface OrderRow {
  id: string
  kind: string
  ref: string
  amount_cents: number
  currency: string
  status: string
  created_at: string
  paid_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

interface DeckRow {
  slug: string
  title: string
  href: string
}

const KNOWN_STATUSES = new Set<UserOrder['status']>(['pending', 'paid', 'refunded', 'cancelled'])

function normalizeStatus(value: string): UserOrder['status'] {
  return KNOWN_STATUSES.has(value as UserOrder['status'])
    ? (value as UserOrder['status'])
    : 'unknown'
}

/** Every visible order belonging to one user, newest first, with deck refs resolved
 *  to titles in a single follow-up query (not one per order). A purchase is the
 *  user's receipt, so a deck that was later unpublished still has to appear — hence
 *  the fallback to the raw `ref` and a null href rather than dropping the row.
 *  `user_deleted_at` only hides the row; entitlement checks deliberately ignore it. */
export async function listUserOrders(supabase: SupabaseClient, userId: string): Promise<UserOrder[]> {
  const { data, error } = await supabase
    .from('ai_pulse_orders')
    .select(
      'id, kind, ref, amount_cents, currency, status, created_at, paid_at, cancelled_at, cancel_reason'
    )
    .eq('user_id', userId)
    .is('user_deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const rows = data as OrderRow[]
  const deckSlugs = [...new Set(rows.filter((row) => row.kind === 'deck').map((row) => row.ref))]

  const decks = new Map<string, DeckRow>()
  if (deckSlugs.length > 0) {
    const { data: deckRows } = await supabase
      .from('ai_pulse_decks')
      .select('slug, title, href')
      .in('slug', deckSlugs)

    for (const deck of (deckRows ?? []) as DeckRow[]) decks.set(deck.slug, deck)
  }

  return rows.map((row) => {
    const deck = row.kind === 'deck' ? decks.get(row.ref) : undefined
    return {
      id: row.id,
      title: deck?.title ?? row.ref,
      href: row.status === 'paid' ? deck?.href ?? null : null,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: normalizeStatus(row.status),
      createdAt: row.created_at,
      paidAt: row.paid_at,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
    }
  })
}
