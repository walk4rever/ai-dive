import Link from 'next/link'
import { formatPrice } from '@/lib/decks/access'
import type { UserOrder } from '@/lib/orders/list'
import { Card } from '@/components/ui/Card'

interface OrdersCardProps {
  orders: UserOrder[]
  /** Admins read every deck without buying it, so an empty list means something
   *  different for them than for a regular user — say which. */
  isAdmin: boolean
  className?: string
}

const STATUS: Record<UserOrder['status'], { label: string; className: string }> = {
  paid: { label: '已支付', className: 'border-[var(--border)] text-[var(--muted)]' },
  pending: { label: '待支付', className: 'border-[var(--accent)] text-[var(--accent)]' },
  refunded: { label: '已退款', className: 'border-[var(--border)] text-[var(--subtle)]' },
}

function formatDate(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function OrdersCard({ orders, isAdmin, className = '' }: OrdersCardProps) {
  return (
    <Card
      kicker="我的订单"
      aside={orders.length > 0 ? <span className="date">共 {orders.length} 笔</span> : undefined}
      className={className}
    >
      {orders.length === 0 ? (
        <div className="mt-6">
          <p className="text-sm text-[var(--muted)]">还没有订单。</p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--subtle)]">
            {isAdmin
              ? '管理员可直接阅读全部出品，无需购买。'
              : '在「出品」里购买的内容会出现在这里，购买后永久可读。'}
          </p>
          <Link
            href="/decks"
            className="mt-5 inline-block text-sm text-[var(--accent)] transition-opacity hover:opacity-70"
          >
            去看看出品 →
          </Link>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium leading-snug">{order.title}</p>
                <p className="date mt-1.5">
                  {formatDate(order.paidAt ?? order.createdAt)} · {formatPrice(order.amountCents, order.currency)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] leading-5 ${STATUS[order.status].className}`}
              >
                {STATUS[order.status].label}
              </span>
              {order.href && (
                <a
                  href={order.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                >
                  打开 ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
