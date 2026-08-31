import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { DeckEditForm } from './DeckEditForm'

interface PageParams {
  params: Promise<{ slug: string }>
}

export default async function EditDeckPage({ params }: PageParams) {
  const { slug } = await params
  const supabase = await createServiceClient()
  const { data: deck } = await supabase
    .from('ai_pulse_decks')
    .select('slug, href, title, kicker, description, meta, date, status, price_cents, currency')
    .eq('slug', slug)
    .single()

  if (!deck) redirect('/admin/decks')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <Link href="/admin/decks" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          ← 返回列表
        </Link>
        <a href={deck.href} target="_blank" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          查看正文 →
        </a>
      </div>
      <p className="font-serif text-2xl font-medium mb-2">编辑出品</p>
      <p className="text-xs text-[var(--muted)] mb-6">
        正文托管在 R2，这里只能改元数据和价格；换正文请用 <code>scripts/import-deck.mjs</code>
      </p>
      <DeckEditForm deck={deck} />
    </div>
  )
}
