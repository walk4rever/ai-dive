import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdminSubscribers, type AdminSubscriber } from '@/lib/admin/subscribers'
import { Card } from '@/components/ui/Card'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const STATUS_LABEL: Record<AdminSubscriber['status'], string> = {
  active: '已确认',
  pending: '待确认',
  unsubscribed: '已退订',
}

const STATUS_CLASS: Record<AdminSubscriber['status'], string> = {
  active: 'border-[var(--border)] text-[var(--muted)]',
  pending: 'border-[var(--accent)] text-[var(--accent)]',
  unsubscribed: 'border-[var(--border)] text-[var(--subtle)]',
}

/** Read-only — no unsubscribe/edit actions here. This list only shows who's on the
 *  mailing list; sending to them still happens from the post edit page's own flow. */
export default async function AdminSubscribersPage() {
  const supabase = await createServiceClient()
  const subscribers = await fetchAdminSubscribers(supabase)

  const activeCount = subscribers.filter((s) => s.status === 'active').length
  const pendingCount = subscribers.filter((s) => s.status === 'pending').length
  const unsubscribedCount = subscribers.filter((s) => s.status === 'unsubscribed').length

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <p className="kicker">Mailing List</p>
          <p className="font-serif text-2xl font-medium tracking-tight mt-1">订阅管理</p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {activeCount} 已确认 · {pendingCount} 待确认 · {unsubscribedCount} 已退订 · 共 {subscribers.length}
        </p>
      </div>

      {subscribers.length === 0 ? (
        <p className="py-8 text-sm text-[var(--muted)] text-center">还没有任何订阅。</p>
      ) : (
        <>
          <div className="hidden md:grid md:grid-cols-[1fr_70px_100px_100px_100px] md:gap-3 px-2 pb-2 border-b border-[var(--border)] text-xs text-[var(--muted)]">
            <span>邮箱 / 姓名</span>
            <span>层级</span>
            <span>订阅时间</span>
            <span>确认时间</span>
            <span>状态</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {subscribers.map((sub) => (
              <div key={sub.id} className="py-3 md:grid md:grid-cols-[1fr_70px_100px_100px_100px] md:items-center gap-3 px-2">
                <div className="min-w-0">
                  <p className="text-sm truncate">{sub.email}</p>
                  {sub.name && <p className="text-xs text-[var(--muted)] mt-0.5">{sub.name}</p>}
                </div>
                <p className="kicker mt-2 md:mt-0">{sub.tier === 'paid' ? '付费' : '免费'}</p>
                <p className="date mt-2 md:mt-0">{formatDate(sub.subscribed_at)}</p>
                <p className="date mt-2 md:mt-0">{formatDate(sub.confirmed_at)}</p>
                <p className="mt-2 md:mt-0">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] leading-5 ${STATUS_CLASS[sub.status]}`}>
                    {STATUS_LABEL[sub.status]}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
