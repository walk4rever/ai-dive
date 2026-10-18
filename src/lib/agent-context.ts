import type { SupabaseClient } from '@supabase/supabase-js'
import { parseYmd } from './timezone'

export type AgentPageContext =
  | { kind: 'article'; id: string }
  | { kind: 'intel_day'; id: string }

export function agentPageContextKey(context?: AgentPageContext | null): string {
  if (!context) return 'global'
  return context.kind === 'intel_day' ? `intel-day:${context.id}` : context.id
}

export function parseAgentPageContext(value: unknown): AgentPageContext | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as { kind?: unknown; id?: unknown }
  if (typeof candidate.id !== 'string') return null
  const id = candidate.id.trim()
  if (!id || id.length > 200) return null

  if (candidate.kind === 'article') return { kind: 'article', id }
  if (candidate.kind === 'intel_day' && parseYmd(id)) return { kind: 'intel_day', id }
  return null
}

/** Normalizes the client-supplied article slug into the storage/lookup key for a chat
 *  thread. Deliberately does NOT validate against the stories table (that's a separate
 *  concern handled by resolveAgentPageContext()) — using the
 *  DB-validated slug here would make the persisted context_key disagree with what the
 *  client used to persist turns whenever an article is unpublished/premium.
 *
 *  Kept in this file (rather than resolve-article-slug.ts) because this module is
 *  imported by the client-side useAgentChat hook — it must never pull in server-only
 *  code (like next/headers via the Supabase server client). */
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
