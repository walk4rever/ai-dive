import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { markdownToHtml as markdownToHtmlPipeline } from './markdown-pipeline.mjs'
import { markdownToHtml } from './markdown'

const ALLOWED_HOST = 'https://cdn.example.com'

describe('::embed directive', () => {
  const originalPublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL

  beforeEach(() => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = ALLOWED_HOST
  })

  afterEach(() => {
    if (originalPublicUrl === undefined) delete process.env.CLOUDFLARE_R2_PUBLIC_URL
    else process.env.CLOUDFLARE_R2_PUBLIC_URL = originalPublicUrl
  })

  it('renders an allowed src as a sandboxed iframe', async () => {
    const markdown = '::embed{src="https://cdn.example.com/posts/foo/embed.html" height="1600"}'

    const html = await markdownToHtmlPipeline(markdown, { sanitize: false })

    expect(html).toContain('<iframe')
    expect(html).toContain('src="https://cdn.example.com/posts/foo/embed.html"')
    expect(html).toContain('sandbox="allow-scripts"')
    expect(html).toContain('height:1600px')
    expect(html).toContain('data-ai-dive-embed="true"')
    expect(html).not.toContain('allow-same-origin')
  })

  it('blocks a src on a disallowed host', async () => {
    const markdown = '::embed{src="https://evil.example.com/x.html" height="500"}'

    const html = await markdownToHtmlPipeline(markdown, { sanitize: false })

    expect(html).not.toContain('<iframe')
    expect(html).toContain('Embed blocked')
  })

  it('fails closed when no R2 public host is configured', async () => {
    delete process.env.CLOUDFLARE_R2_PUBLIC_URL
    const markdown = '::embed{src="https://cdn.example.com/posts/foo/embed.html" height="500"}'

    const html = await markdownToHtmlPipeline(markdown, { sanitize: false })

    expect(html).not.toContain('<iframe')
    expect(html).toContain('Embed blocked')
  })

  it('falls back to a default height when omitted, and clamps out-of-range values', async () => {
    const noHeight = await markdownToHtmlPipeline(
      '::embed{src="https://cdn.example.com/a.html"}',
      { sanitize: false }
    )
    expect(noHeight).toContain('height:800px')

    const tooTall = await markdownToHtmlPipeline(
      '::embed{src="https://cdn.example.com/a.html" height="999999"}',
      { sanitize: false }
    )
    expect(tooTall).toContain('height:40000px')
  })

  it('survives the sanitize:true path (agent API) with sandbox intact', async () => {
    const markdown = '::embed{src="https://cdn.example.com/posts/foo/embed.html" height="1200"}'

    const html = await markdownToHtml(markdown)

    expect(html).toContain('<iframe')
    expect(html).toContain('sandbox="allow-scripts"')
    expect(html).toContain('height:1200px')
  })
})
