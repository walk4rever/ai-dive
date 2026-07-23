import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdown'

describe('markdownToHtml callouts', () => {
  it('renders a [!HIGHLIGHTS] blockquote as a highlights callout', async () => {
    const markdown = ['> [!HIGHLIGHTS] 核心看点', '> 这是重点内容'].join('\n')

    const html = await markdownToHtml(markdown)

    expect(html).toContain('class="callout callout-highlights"')
    expect(html).toContain('class="callout-label">HIGHLIGHTS</span> 核心看点')
    expect(html).toContain('这是重点内容')
  })

  it('renders known callout types with their dedicated class', async () => {
    const markdown = '> [!TIPS]\n> 提示内容'

    const html = await markdownToHtml(markdown)

    expect(html).toContain('class="callout callout-tips"')
  })
})
