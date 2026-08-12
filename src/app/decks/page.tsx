import Link from 'next/link'
import { ListPageHeader } from '@/components/ListPageHeader'

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

const decks: Deck[] = [
  {
    slug: 'agent-harness',
    href: '/decks/agent-harness.html',
    title: 'Harness 工程：从黑箱到可见',
    kicker: 'HARNESS 系列 · 43 页',
    description:
      '基于《Harness 系列》六篇整理的技术演讲：五个维度、三套实践，附 Uber 与 Ramp 两个完整企业案例。',
    meta: '43 slides · 60 min',
    date: '2026.04',
  },
  {
    slug: 'anthropic-founders-playbook',
    href: '/decks/anthropic-founders-playbook.html',
    title: "The Founder's Playbook：AI-Native 创业指南",
    kicker: 'Anthropic · 35 页',
    description:
      'Anthropic 2026 年官方创始人手册完整精读。覆盖 Idea → MVP → Launch → Scale 四阶段，详解 Claude / Claude Code / Claude Cowork 的实战用法与案例。',
    meta: '35 slides · 25 min',
    date: '2026.05',
  },
  {
    slug: 'k3-course',
    href: '/decks/k3-course/index.html',
    title: 'K3 七天课：从零读懂 47 页技术报告',
    kicker: 'K3 七天课 · 7 篇',
    description:
      '不假设你懂编程、懂数学、懂 AI——只假设你有高中水平。每天先用比喻和图解讲清一个概念，再回到 Kimi K3 技术报告对应章节，七天读完一份 47 页的技术报告。',
    meta: '7 天课程 · 30+ 图解 · 25 道自测题',
    date: '2026.08',
  },
]

const sortedDecks = [...decks].sort((a, b) => b.date.localeCompare(a.date))

export default function DecksPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <ListPageHeader
        kicker="Decks"
        title="出品"
        description="将深度思考浓缩为极具传播力的视觉产品——幻灯片、报告、交互式解读，加速前沿知识的流动。"
        count={decks.length}
      />
      <ul className="flex flex-col gap-10">
        {sortedDecks.map((deck) => (
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
