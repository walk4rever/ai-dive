import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { deriveContextKey, fetchRecentTurns } from '@/lib/agent-context'
import { loginHref } from '@/lib/auth/client'
import { AgentChat } from '@/components/AgentChat'
import type { AgentMessage } from '@/hooks/useAgentChat'

export const metadata: Metadata = {
  title: '探索 | AI-DIVE',
  description: '深入任何一个 AI 技术话题——论文、GitHub 项目、工程实践。',
}

export default async function AgentPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect(loginHref('/agent'))

  const supabase = await createServiceClient()
  const turns = await fetchRecentTurns(supabase, session.user.id, deriveContextKey(undefined))
  const initialMessages: AgentMessage[] = turns.map((turn) => ({
    role: turn.role,
    text: turn.text,
    imageUrls: turn.imageUrls.length ? turn.imageUrls : undefined,
  }))

  return (
    <div className="agent-screen">
      <AgentChat initialMessages={initialMessages} />
    </div>
  )
}
