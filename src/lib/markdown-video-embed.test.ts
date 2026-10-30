import { describe, expect, it } from 'vitest'
import { markdownToHtml as markdownToHtmlPipeline } from './markdown-pipeline.mjs'

describe('rehypeMp4Embeds', () => {
  it('renders a bare mp4 URL as a video player', async () => {
    const markdown = 'https://static.example.com/static/2026/demo.mp4'

    const html = await markdownToHtmlPipeline(markdown, { sanitize: false })

    expect(html).toContain('<video')
    expect(html).toContain('src="https://static.example.com/static/2026/demo.mp4"')
    expect(html).toContain('controls')
    expect(html).toContain('preload="none"')
  })

  it('renders an autolinked mp4 anchor (text == href) as a video player', async () => {
    const url = 'https://static.example.com/static/2026/demo.mp4'
    const markdown = `[${url}](${url})`

    const html = await markdownToHtmlPipeline(markdown, { sanitize: false })

    expect(html).toContain('<video')
    expect(html).not.toContain('<a href')
  })

  it('keeps descriptive link text as a plain link', async () => {
    const markdown = '[观看视频](https://static.example.com/static/2026/demo.mp4)'

    const html = await markdownToHtmlPipeline(markdown, { sanitize: false })

    expect(html).not.toContain('<video')
    expect(html).toContain('<a href="https://static.example.com/static/2026/demo.mp4"')
  })

  it('ignores non-video URLs', async () => {
    const markdown = 'https://example.com/article.mp4x'

    const html = await markdownToHtmlPipeline(markdown, { sanitize: false })

    expect(html).not.toContain('<video')
  })

  it('supports webm and mov', async () => {
    for (const ext of ['webm', 'mov']) {
      const html = await markdownToHtmlPipeline(`https://static.example.com/v/clip.${ext}`, { sanitize: false })
      expect(html).toContain('<video')
    }
  })
})
