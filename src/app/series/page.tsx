import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { ListPageHeader } from '@/components/ListPageHeader'

export const revalidate = 60

export const metadata = {
  title: '专题 | AI早知道',
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
        description="围绕一个主题深入探索 —— 从线索到全貌。"
        count={topicList.length}
      />

      {topicList.length === 0 && (
        <p className="text-sm text-[var(--muted)]">专题内容即将发布。</p>
      )}

      <div className="space-y-16">
        {topicList.map((topic) => {
          const items = grouped.get(topic.id) ?? []
          return (
            <section key={topic.id} id={topic.id}>
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
