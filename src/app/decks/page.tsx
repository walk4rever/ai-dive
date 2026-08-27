import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { ListPageHeader } from '@/components/ListPageHeader'
import { authOptions } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { formatPrice, hasPaidDeckOrder } from '@/lib/decks/access'

export const revalidate = 60

export const metadata = {
  title: '出品 | AI-DIVE',
  description: 'AI-DIVE 出品的深度制作：幻灯片、报告、交互式解读。',
}

interface RawDeck {
  slug: string
  href: string
  title: string
  kicker: string
  description: string
  meta: string
  date: string
  price_cents: number | null
  currency: string
}

export default async function DecksPage() {
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) return <p className="text-sm text-[var(--muted)]">配置未完成。</p>

  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_pulse_decks')
    .select('slug, href, title, kicker, description, meta, date, price_cents, currency')
    .eq('status', 'published')
    .order('date', { ascending: false })

  const rawDecks = (data ?? []) as RawDeck[]

  // Entitlement is per (user, deck) — only worth checking for priced decks, and only
  // when someone is logged in to own an order against. Free decks are unlocked for
  // everyone, logged in or not, so they never need this lookup.
  const session = await getServerSession(authOptions)
  const userId = session?.user.id
  const pricedSlugs = rawDecks.filter((d) => d.price_cents !== null).map((d) => d.slug)
  const unlockedSlugs = new Set<string>()
  if (userId && pricedSlugs.length > 0) {
    const supabaseService = await createServiceClient()
    const results = await Promise.all(
      pricedSlugs.map(async (slug) => [slug, await hasPaidDeckOrder(supabaseService, userId, slug)] as const)
    )
    for (const [slug, owned] of results) if (owned) unlockedSlugs.add(slug)
  }

  const decks = rawDecks.map((deck) => ({
    ...deck,
    date: deck.date.replaceAll('-', '.'),
    unlocked: deck.price_cents === null || unlockedSlugs.has(deck.slug),
  }))

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <ListPageHeader
        kicker="Decks"
        title="出品"
        description="将深度思考浓缩为极具传播力的视觉产品——幻灯片、报告、交互式解读，加速前沿知识的流动。"
        count={decks.length}
      />
      <ul className="flex flex-col gap-10">
        {decks.map((deck) => {
          const priceLabel = deck.price_cents !== null ? formatPrice(deck.price_cents, deck.currency) : null

          const body = (
            <>
              <p className="kicker mb-3" style={{ color: 'var(--accent)' }}>
                {deck.kicker}
                {priceLabel && deck.unlocked && ' · 已购买'}
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
                {priceLabel && !deck.unlocked && (
                  <>
                    <span>·</span>
                    <span>{priceLabel}</span>
                  </>
                )}
              </p>
            </>
          )

          return (
            <li key={deck.slug}>
              {deck.unlocked ? (
                <Link
                  href={deck.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block border-b border-[var(--border)] pb-10 transition-colors hover:border-[var(--accent)]"
                >
                  {body}
                </Link>
              ) : (
                <div className="block border-b border-[var(--border)] pb-10">
                  {body}
                  <p className="mt-3 text-sm text-[var(--muted)]">购买功能开发中，敬请期待</p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
