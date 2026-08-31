import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdminDecks } from '@/lib/admin/decks'
import { formatPrice } from '@/lib/decks/access'
import { Card } from '@/components/ui/Card'

function formatDate(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default async function AdminDecksPage() {
  const supabase = await createServiceClient()
  const decks = await fetchAdminDecks(supabase)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <p className="kicker">Products</p>
          <p className="font-serif text-2xl font-medium tracking-tight mt-1">出品管理</p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          正文来自 R2，只能改元数据和价格 — 上新 / 换正文请用 <code>scripts/import-deck.mjs</code>
        </p>
      </div>

      {decks.length === 0 ? (
        <p className="py-8 text-sm text-[var(--muted)] text-center">还没有任何出品。</p>
      ) : (
        <>
          <div className="hidden md:grid md:grid-cols-[100px_90px_1fr_90px_70px] md:gap-3 px-2 pb-2 border-b border-[var(--border)] text-xs text-[var(--muted)]">
            <span>日期</span>
            <span>类型</span>
            <span>标题</span>
            <span>价格</span>
            <span>状态</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {decks.map((deck) => (
              <Link
                key={deck.id}
                href={`/admin/decks/${deck.slug}`}
                className="py-3 flex flex-col gap-1 px-2 md:grid md:grid-cols-[100px_90px_1fr_90px_70px] md:items-center md:gap-3 group"
              >
                <p className="date">{formatDate(deck.date)}</p>
                <p className="kicker">{deck.kicker}</p>
                <p className="text-sm truncate group-hover:text-[var(--accent)] transition-colors">{deck.title}</p>
                <p className="text-sm">
                  {deck.price_cents === null ? <span className="text-[var(--muted)]">免费</span> : formatPrice(deck.price_cents, deck.currency)}
                </p>
                <p className="kicker">{deck.status === 'draft' ? '草稿' : '发布'}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
