import type { SupabaseClient } from '@supabase/supabase-js'

/** Normalizes the client-supplied article slug into the storage/lookup key for a chat
 *  thread. Deliberately does NOT validate against the stories table (that's a separate
 *  concern handled by resolveArticleSlug() in /api/agent) — using the DB-validated slug
 *  here would make the persisted context_key disagree with what the client used to
 *  persist turns whenever an article is unpublished/premium. */
export function deriveContextKey(articleSlug?: string | null): string {
  const trimmed = articleSlug?.trim()
  return trimmed ? trimmed : 'global'
}

export interface StoredChatTurn {
  role: 'user' | 'assistant'
  text: string
  imageUrls: string[]
  createdAt: string
}

const HISTORY_LIMIT = 10

/** Fetches the most recent turns for a (user, contextKey) thread, oldest first. */
export async function fetchRecentTurns(
  supabase: SupabaseClient,
  userId: string,
  contextKey: string
): Promise<StoredChatTurn[]> {
  const { data, error } = await supabase
    .from('ai_pulse_chat_turns')
    .select('role, text, image_urls, created_at')
    .eq('user_id', userId)
    .eq('context_key', contextKey)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error || !data) return []

  return data
    .map((row) => ({
      role: row.role as 'user' | 'assistant',
      text: row.text as string,
      imageUrls: (row.image_urls as string[] | null) ?? [],
      createdAt: row.created_at as string,
    }))
    .reverse()
}
