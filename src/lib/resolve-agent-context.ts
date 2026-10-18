import { createClient } from '@/lib/supabase/server'
import {
  agentPageContextKey,
  parseAgentPageContext,
  type AgentPageContext,
} from '@/lib/agent-context'

export interface ResolvedAgentContext {
  context: AgentPageContext
  contextKey: string
}

/** Validates the page context before it becomes both a chat history key and a
 *  pi-gateway session key. Article slugs must still resolve to a published story;
 *  intel dates only need a valid calendar date. */
export async function resolveAgentPageContext(
  candidate: unknown,
  legacyArticleSlug?: unknown
): Promise<ResolvedAgentContext | undefined> {
  const parsed = parseAgentPageContext(candidate)
    ?? (typeof legacyArticleSlug === 'string' && legacyArticleSlug
      ? parseAgentPageContext({ kind: 'article', id: legacyArticleSlug })
      : null)

  if (!parsed) return undefined
  if (parsed.kind === 'intel_day') {
    return { context: parsed, contextKey: agentPageContextKey(parsed) }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_pulse_stories')
    .select('slug')
    .eq('slug', parsed.id)
    .eq('status', 'published')
    .eq('is_premium', false)
    .single()

  if (!data?.slug) return undefined
  const context: AgentPageContext = { kind: 'article', id: data.slug }
  return { context, contextKey: agentPageContextKey(context) }
}
