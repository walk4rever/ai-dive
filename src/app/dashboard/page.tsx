import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { createServiceClient } from '@/lib/supabase/server'
import { currentPeriod, ensureFreeGrant, getBalance, FREE_MONTHLY_CREDITS } from '@/lib/credits'
import { listUserOrders } from '@/lib/orders/list'
import { QuotaCard } from '@/components/dashboard/QuotaCard'
import { OrdersCard } from '@/components/dashboard/OrdersCard'
import { AccountCard } from '@/components/dashboard/AccountCard'
import { LogoutButton } from '@/components/dashboard/LogoutButton'

export const metadata = {
  title: '控制台 | AI-DIVE',
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect(loginHref('/dashboard'))

  const supabase = await createServiceClient()
  const isAdmin = session.user.role === 'admin'
  const period = currentPeriod()

  // Same lazy grant the agent route does — without it a user who hasn't spent a turn
  // this month would read a balance of 0 and think the quota was gone. Idempotent, so
  // rendering the console repeatedly is harmless; a failure here must not take the
  // page down, it just means the number is stale for one render.
  await ensureFreeGrant(supabase, session.user.id, period).catch(() => undefined)

  const [{ data: profile }, credits, orders] = await Promise.all([
    supabase.from('ai_pulse_users').select('username').eq('id', session.user.id).single(),
    getBalance(supabase, session.user.id, period),
    listUserOrders(supabase, session.user.id),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10 border-b border-[var(--border)] pb-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div>
            <p className="kicker mb-4" style={{ color: 'var(--accent)' }}>Console</p>
            <h1 className="font-serif text-4xl font-medium leading-[1.15] tracking-tight md:text-5xl">控制台</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)] hover:text-[var(--accent)]"
              >
                管理后台
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
        {isAdmin && (
          <p className="mt-6">
            <span className="rounded-full border border-[var(--accent)] px-2.5 py-0.5 text-[11px] leading-5 text-[var(--accent)]">
              管理员
            </span>
          </p>
        )}
      </header>

      {/* Two summary cards up top, the list that actually grows underneath. DOM order
          is the mobile order (quota → orders → account); explicit grid placement puts
          account beside the quota on desktop without reordering the markup. */}
      <div className="grid gap-5 md:grid-cols-2">
        <QuotaCard credits={credits} total={FREE_MONTHLY_CREDITS} period={period} />
        <OrdersCard orders={orders} isAdmin={isAdmin} className="md:col-span-2 md:row-start-2" />
        <AccountCard
          email={session.user.email ?? ''}
          username={profile?.username ?? ''}
          className="md:col-start-2 md:row-start-1"
        />
      </div>
    </div>
  )
}
