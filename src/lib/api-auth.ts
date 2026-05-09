import type { PostContentType } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'
import { hashToken } from '@/lib/auth/token'

const ALL_TYPES: PostContentType[] = ['brief', 'analysis', 'case', 'interview']

export interface AuthorConfig {
  authorSlug: string
  allowedTypes: PostContentType[]
  agentId?: string
  userId?: string
  username?: string
}

export async function resolveAuthor(bearerToken: string | null): Promise<AuthorConfig | null> {
  if (!bearerToken || !bearerToken.startsWith('aipk_')) return null
  return resolveAgentKey(bearerToken)
}

async function resolveAgentKey(key: string): Promise<AuthorConfig | null> {
  const hash = hashToken(key)
  const supabase = await createServiceClient()

  const { data } = await supabase
    .from('ai_pulse_agents')
    .select('id, name, status, user_id')
    .eq('key_hash', hash)
    .single()

  if (!data || data.status !== 'active') return null

  const { data: user } = data.user_id
    ? await supabase
        .from('ai_pulse_users')
        .select('username')
        .eq('id', data.user_id)
        .single()
    : { data: null }

  return {
    authorSlug: slugify(data.name),
    allowedTypes: ALL_TYPES,
    agentId: data.id,
    userId: data.user_id,
    username: user?.username ?? undefined,
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
