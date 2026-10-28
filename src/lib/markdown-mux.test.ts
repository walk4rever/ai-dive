import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdown-pipeline.mjs'

// @ts-expect-error no types for the .mjs pipeline
const render = (md: string, sanitize = false) => markdownToHtml(md, { sanitize })

describe('Mux embeds', () => {
  it('turns a lone player.mux.com URL into a 16:9 player iframe', async () => {
    const html = await render('https://player.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT')

    expect(html).toContain('<iframe')
    expect(html).toContain('src="https://player.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT"')
    expect(html).toContain('aspect-ratio:16/9')
    expect(html).toContain('allowfullscreen')
  })

  it('accepts image.mux.com thumbnail URLs (playback id in path)', async () => {
    const html = await render('https://image.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT/thumbnail.jpg')

    expect(html).toContain('src="https://player.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT"')
  })

  it('accepts stream.mux.com .m3u8 URLs', async () => {
    const html = await render('https://stream.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT.m3u8')

    expect(html).toContain('src="https://player.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT"')
  })

  it('leaves non-Mux URLs alone', async () => {
    const html = await render('https://example.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT')

    expect(html).not.toContain('<iframe')
  })

  it('leaves Mux links with custom link text alone', async () => {
    const html = await render('[观看演示视频](https://player.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT)')

    expect(html).not.toContain('<iframe')
    expect(html).toContain('观看演示视频')
  })

  it('survives sanitize mode', async () => {
    const html = await render('https://player.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT', true)

    expect(html).toContain('<iframe')
    expect(html).toContain('src="https://player.mux.com/DiNxmcYp7MMjKOo4s38pwdK5rTERwVHT"')
  })
})

describe('figure / figcaption', () => {
  it('passes figure and figcaption through sanitize mode', async () => {
    const md = '<figure><img src="https://example.com/chart.png" alt="准确率曲线"><figcaption>原文为交互图表，此为静态帧</figcaption></figure>'

    const html = await render(md, true)

    expect(html).toContain('<figure>')
    expect(html).toContain('<figcaption>')
    expect(html).toContain('原文为交互图表，此为静态帧')
  })
})
