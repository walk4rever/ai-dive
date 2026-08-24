import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { createServiceClient } from '@/lib/supabase/server'
import { DashboardClient, type Agent } from '@/components/DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect(loginHref('/dashboard'))

  const supabase = await createServiceClient()

  const [{ data: agents }, { data: profile }] = await Promise.all([
    supabase
      .from('ai_pulse_agents')
      .select('id, name, status, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true }),
    supabase.from('ai_pulse_users').select('username').eq('id', session.user.id).single(),
  ])

  return (
    <DashboardClient
      email={session.user.email ?? ''}
      username={profile?.username ?? ''}
      isAdmin={session.user.role === 'admin'}
      initialAgents={(agents ?? []) as Agent[]}
    />
  )
}
