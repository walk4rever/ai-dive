import type { SupabaseClient } from '@supabase/supabase-js'

export type DeckKicker = 'KEYNOTE' | 'COURSE' | 'REPORT' | 'PLAYBOOK'

export interface AdminDeck {
  id: string
  slug: string
  /** R2 content path — read-only here. Content is uploaded via scripts/import-deck.mjs,
   *  not edited in the admin UI, so href never appears in an update payload. */
  href: string
  title: string
  kicker: DeckKicker
  description: string
  meta: string
  date: string
  status: 'draft' | 'published'
  price_cents: number | null
  currency: string
}

/** Every deck regardless of status — the public `/decks` page only shows `published`
 *  ones, but an admin needs to see drafts too to price/edit them before they go live. */
export async function fetchAdminDecks(supabase: SupabaseClient): Promise<AdminDeck[]> {
  const { data, error } = await supabase
    .from('ai_pulse_decks')
    .select('id, slug, href, title, kicker, description, meta, date, status, price_cents, currency')
    .order('date', { ascending: false })

  if (error || !data) return []

  return data as AdminDeck[]
}
