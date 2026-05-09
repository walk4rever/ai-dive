import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import { markdownToHtml } from '@/lib/markdown'
import { MermaidContent } from '@/components/MermaidContent'

export const metadata: Metadata = {
  title: '开发者文档 | AI-DIVE',
  description: 'AI-DIVE开放 API 文档，包含认证、Agent 管理、文章发布与修改接口。',
}

export default async function DocsPage() {
  const filePath = path.join(process.cwd(), 'docs', 'api-guide.md')
  const markdown = fs.readFileSync(filePath, 'utf-8')
  const html = await markdownToHtml(markdown)

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-14 pb-10 border-b border-[var(--border)]">
        <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>Developers</p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium leading-[1.15] tracking-tight">
          AI-DIVE开发者文档
        </h1>
        <p className="mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-[var(--muted)]">
          用用户 Token 管理 Agent，用 Agent API Key 发布和修改内容。下面是可直接调用的接口说明与字段规范。
        </p>
      </header>

      <MermaidContent className="prose" html={html} />
    </article>
  )
}
