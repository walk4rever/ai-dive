import { describe, it, expect } from 'vitest'
import { buildHighlightShareText } from './highlight-share'

describe('buildHighlightShareText', () => {
  it('builds share text with all fields', () => {
    const result = buildHighlightShareText({
      title: 'Transformer 架构详解',
      slug: 'transformer-architecture',
      quoteText: 'Self-attention 机制是 Transformer 的核心创新。',
      author: 'RAFA',
      siteOrigin: 'https://ai.air7.fun',
    })

    expect(result).toContain('"Self-attention 机制是 Transformer 的核心创新。"')
    expect(result).toContain('—— 摘自《Transformer 架构详解》 · RAFA')
    expect(result).toContain('🔗 原文链接：https://ai.air7.fun/post/transformer-architecture')
    expect(result).toContain('【AI-DIVE】深入 AI 技术核心，从论文到实战全面拆解。')
  })

  it('handles title without 书名号', () => {
    const result = buildHighlightShareText({
      title: 'GPT-4 解读',
      slug: 'gpt-4',
      quoteText: '测试内容',
    })

    expect(result).toContain('《GPT-4 解读》')
  })

  it('handles title with existing 书名号', () => {
    const result = buildHighlightShareText({
      title: '《深度学习》',
      slug: 'dl-notes',
      quoteText: '测试内容',
    })

    expect(result).toContain('《深度学习》')
    expect(result).not.toContain('《《')
  })

  it('handles partial 书名号 in title', () => {
    const result = buildHighlightShareText({
      title: '《深度学习》读书笔记',
      slug: 'dl-notes',
      quoteText: '测试内容',
    })

    // 部分书名号的标题会被完整包裹
    expect(result).toContain('《《深度学习》读书笔记》')
  })

  it('omits author when empty or default', () => {
    const result1 = buildHighlightShareText({
      title: '测试文章',
      slug: 'test',
      quoteText: '测试',
      author: '',
    })
    expect(result1).not.toContain(' · ')

    const result2 = buildHighlightShareText({
      title: '测试文章',
      slug: 'test',
      quoteText: '测试',
      author: 'AI-DIVE',
    })
    expect(result2).not.toContain(' · AI-DIVE')

    const result3 = buildHighlightShareText({
      title: '测试文章',
      slug: 'test',
      quoteText: '测试',
      author: '编辑部',
    })
    expect(result3).not.toContain(' · 编辑部')
  })

  it('formats multi-line quote correctly', () => {
    const result = buildHighlightShareText({
      title: '测试',
      slug: 'test',
      quoteText: '第一段\n\n第二段\n第三段',
    })

    expect(result).toContain('"第一段\n\n第二段\n第三段"')
  })

  it('uses default site origin when not provided', () => {
    const result = buildHighlightShareText({
      title: '测试',
      slug: 'test-slug',
      quoteText: '测试',
    })

    expect(result).toMatch(/🔗 原文链接：https?:\/\/.+\/post\/test-slug/)
  })
})
