import { describe, expect, it } from 'vitest'
import { buildColumnNavigation, buildTopicNavigation } from './article-navigation'

describe('buildTopicNavigation', () => {
  const stories = [
    { id: 'story-3', slug: 'three', title: '第三篇', topic_order: 3 },
    { id: 'story-1', slug: 'one', title: '第一篇', topic_order: 1 },
    { id: 'story-2', slug: 'two', title: '第二篇', topic_order: 2 },
  ]

  it('orders stories by the explicit topic sequence', () => {
    const navigation = buildTopicNavigation(
      stories,
      'story-2',
      { id: 'topic-1', name: 'Agent 工程化' }
    )

    expect(navigation).toMatchObject({
      kind: 'topic',
      heading: '专题 · Agent 工程化',
      position: '2 / 3',
      previous: { slug: 'one', title: '第一篇' },
      next: { slug: 'three', title: '第三篇' },
      previousLabel: '上一篇',
      nextLabel: '下一篇',
      allHref: '/series#topic-1',
    })
  })

  it('returns null when the topic has no sibling article', () => {
    expect(
      buildTopicNavigation(
        [{ id: 'story-1', slug: 'one', title: '第一篇', topic_order: 1 }],
        'story-1',
        { id: 'topic-1', name: 'Agent 工程化' }
      )
    ).toBeNull()
  })
})

describe('buildColumnNavigation', () => {
  const stories = [
    { id: 'story-3', slug: 'three', title: '较新', published_at: '2026-10-03T00:00:00Z', created_at: '2026-10-03T00:00:00Z' },
    { id: 'story-2', slug: 'two', title: '当前', published_at: '2026-10-02T00:00:00Z', created_at: '2026-10-02T00:00:00Z' },
    { id: 'story-1', slug: 'one', title: '较早', published_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
  ]

  it('uses older/newer wording for same-column navigation', () => {
    const navigation = buildColumnNavigation(stories, 'story-2', 'dive', '深度')

    expect(navigation).toMatchObject({
      kind: 'column',
      heading: '继续阅读 · 深度',
      previous: { slug: 'one', title: '较早' },
      next: { slug: 'three', title: '较新' },
      previousLabel: '更早一篇',
      nextLabel: '更新一篇',
      allHref: '/dives',
      allLabel: '查看全部深度',
    })
  })

  it('returns null when the current story is not in the list', () => {
    expect(buildColumnNavigation(stories, 'missing', 'dive', '深度')).toBeNull()
  })
})
