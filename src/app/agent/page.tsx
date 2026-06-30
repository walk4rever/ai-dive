import type { Metadata } from 'next'
import { AgentChat } from '@/components/AgentChat'

export const metadata: Metadata = {
  title: '探索 | AI-DIVE',
  description: '深入任何一个 AI 技术话题——论文、GitHub 项目、工程实践。',
}

export default function AgentPage() {
  return (
    <div className="agent-screen">
      <AgentChat />
    </div>
  )
}
