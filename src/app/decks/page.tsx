import Link from 'next/link'
import { ListPageHeader } from '@/components/ListPageHeader'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'

export const revalidate = 60

export const metadata = {
  title: '出品 | AI-DIVE',
  description: 'AI-DIVE 出品的深度制作：幻灯片、报告、交互式解读。',
}

interface Deck {
  slug: string
  href: string
  title: string
  kicker: string
  description: string
  meta: string
  date: string
}

export default async function DecksPage() {
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) return <p className="text-sm text-[var(--muted)]">配置未完成。</p>

  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_pulse_decks')
    .select('slug, href, title, kicker, description, meta, date')
    .eq('status', 'published')
    .order('date', { ascending: false })

  const decks = (data ?? []).map((deck) => ({ ...deck, date: deck.date.slice(0, 7).replace('-', '.') })) as Deck[]

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <ListPageHeader
        kicker="Decks"
        title="出品"
        description="将深度思考浓缩为极具传播力的视觉产品——幻灯片、报告、交互式解读，加速前沿知识的流动。"
        count={decks.length}
      />
      <ul className="flex flex-col gap-10">
        {decks.map((deck) => (
          <li key={deck.slug}>
            <Link
              href={deck.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block border-b border-[var(--border)] pb-10 transition-colors hover:border-[var(--accent)]"
            >
              <p className="kicker mb-3" style={{ color: 'var(--accent)' }}>
                {deck.kicker}
              </p>
              <h2 className="font-serif text-2xl md:text-3xl font-medium leading-snug tracking-tight text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)]">
                {deck.title}
              </h2>
              <p className="mt-4 text-base text-[var(--muted)] leading-relaxed">
                {deck.description}
              </p>
              <p className="date mt-5 flex gap-4">
                <span>{deck.date}</span>
                <span>·</span>
                <span>{deck.meta}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
