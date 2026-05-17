import Link from 'next/link'
import { ListPageHeader } from '@/components/ListPageHeader'

export const metadata = {
  title: '演讲 Decks | AI-DIVE',
  description: '基于 AI-DIVE系列整理的技术演讲幻灯片。',
}

interface Deck {
  slug: string
  title: string
  kicker: string
  description: string
  slides: number
  duration: string
  date: string
}

const decks: Deck[] = [
  {
    slug: 'agent-harness',
    title: 'Harness 工程：从黑箱到可见',
    kicker: 'HARNESS 系列 · 43 页',
    description:
      '基于《Harness 系列》六篇整理的技术演讲：五个维度、三套实践，附 Uber 与 Ramp 两个完整企业案例。',
    slides: 43,
    duration: '60 min',
    date: '2026.04',
  },
  {
    slug: 'anthropic-founders-playbook',
    title: "The Founder's Playbook：AI-Native 创业指南",
    kicker: 'Anthropic · 35 页',
    description:
      'Anthropic 2026 年官方创始人手册完整精读。覆盖 Idea → MVP → Launch → Scale 四阶段，详解 Claude / Claude Code / Claude Cowork 的实战用法与案例。',
    slides: 35,
    duration: '25 min',
    date: '2026.05',
  },
]

export default function DecksPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <ListPageHeader
        kicker="演讲"
        title="Decks"
        description="把文章变成可讲、可翻、可分享的幻灯片。"
        count={decks.length}
      />
      <ul className="flex flex-col gap-10">
        {decks.map((deck) => (
          <li key={deck.slug}>
            <Link
              href={`/decks/${deck.slug}.html`}
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
                <span>{deck.slides} slides</span>
                <span>·</span>
                <span>{deck.duration}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
