import { createClient } from '@/lib/supabase/server'

/** Validates a client-supplied article slug against the stories table before it's used
 *  as the pi-gateway session key — /api/agent and /api/agent/cancel must both resolve
 *  the same way, or a cancel call would look up a different gateway session than the
 *  one the original prompt actually landed in.
 *
 *  Server-only (imports next/headers via the Supabase server client) — do not import
 *  this from '@/lib/agent-context', which the client-side useAgentChat hook also uses. */
export async function resolveArticleSlug(candidate: unknown): Promise<string | undefined> {
  if (typeof candidate !== 'string' || !candidate) return undefined

  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_pulse_stories')
    .select('slug')
    .eq('slug', candidate)
    .eq('status', 'published')
    .eq('is_premium', false)
    .single()

  return data?.slug
}
