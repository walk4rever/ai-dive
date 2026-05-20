import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { ListPageHeader } from '@/components/ListPageHeader'

export const revalidate = 60

export const metadata = {
  title: '专题 | AI-DIVE',
}

interface TopicItem {
  id: string
  name: string
  description: string
}

interface StoryRow {
  id: string
  slug: string
  title: string
  published_at: string | null
  topic_ids: string[]
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default async function SeriesPage() {
  const supabase = await createServiceClient()

  const [{ data: topics }, { data: stories }] = await Promise.all([
    supabase
      .from('ai_pulse_topics')
      .select('id, name, description')
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_pulse_stories')
      .select('id, slug, title, published_at, topic_ids')
      .eq('status', 'published')
      .not('topic_ids', 'eq', '{}')
      .order('published_at', { ascending: true }),
  ])

  const topicList = (topics ?? []) as TopicItem[]
  const storyList = (stories ?? []) as StoryRow[]

  const grouped = new Map<string, StoryRow[]>()
  for (const story of storyList) {
    for (const topicId of story.topic_ids) {
      const list = grouped.get(topicId) ?? []
      list.push(story)
      grouped.set(topicId, list)
    }
  }

  return (
    <div>
      <ListPageHeader
        kicker="Topics"
        title="专题"
        description="围绕核心议题展开结构化深度探索；通过编织零散的技术线索与行业脉络，还原宏大背景下的系统工程全貌。"
        count={storyList.length}
        hideBorder
      />

      {topicList.length === 0 && (
        <p className="text-sm text-[var(--muted)]">专题内容即将发布。</p>
      )}

      {topicList.length > 0 && (
        <div className="mb-16 pb-10 border-b border-[var(--border-subtle)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
            {topicList.map((topic, index) => {
              const items = grouped.get(topic.id) ?? []
              return (
                <a
                  key={topic.id}
                  href={`#${topic.id}`}
                  className="group flex items-baseline justify-between text-sm py-1.5 border-b border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-coral)] transition-colors duration-200"
                >
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-mono text-xs text-[var(--subtle)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-serif text-base text-[var(--foreground-soft)] group-hover:text-[var(--accent)] transition-colors duration-200 truncate">
                      {topic.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] shrink-0">
                      {items.length} 篇
                    </span>
                    <span className="text-[var(--subtle)] group-hover:text-[var(--accent-coral)] transition-transform duration-200 group-hover:translate-x-0.5 text-xs">
                      →
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-16">
        {topicList.map((topic) => {
          const items = grouped.get(topic.id) ?? []
          return (
            <section key={topic.id} id={topic.id} className="scroll-mt-10">
              <h2 className="font-serif text-2xl md:text-3xl font-medium mb-2 text-[var(--foreground)]">
                {topic.name}
              </h2>
              {topic.description && (
                <p className="text-base text-[var(--muted)] mb-6 leading-relaxed">
                  {topic.description}
                </p>
              )}
              {!topic.description && <div className="mb-6" />}

              <div className="divide-y divide-[var(--border-subtle)]">
                {items.map((story, index) => (
                  <article key={story.id} className="py-5 flex items-baseline gap-6">
                    <span className="kicker shrink-0 w-8" style={{ color: 'var(--accent)' }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link href={`/post/${story.slug}`} className="group">
                        <h3 className="font-serif text-lg md:text-xl font-medium leading-snug group-hover:text-[var(--accent)] transition-colors">
                          {story.title}
                        </h3>
                      </Link>
                    </div>
                    <span className="date shrink-0">{formatDate(story.published_at)}</span>
                  </article>
                ))}

                {items.length === 0 && (
                  <p className="text-sm text-[var(--muted)] py-2">这个专题还没有公开文章。</p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
