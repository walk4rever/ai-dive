import { createClient } from '@/lib/supabase/server'
import { getTypeLabel } from '@/lib/content'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'
import { MermaidContent } from '@/components/MermaidContent'
import { WechatShare } from '@/components/WechatShare'
import { ArticleChatPanel } from '@/components/ArticleChatPanel'
import { ArticleToc } from '@/components/ArticleToc'
import { extractHeadings } from '@/lib/extract-headings'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('title, excerpt')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!post) return {}

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai.air7.fun'
  const imageUrl = `${siteUrl}/post/${slug}/opengraph-image`

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${siteUrl}/post/${slug}`,
      siteName: 'AI-DIVE',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: post.title }],
      type: 'article',
    },
  }
}

function formatPublishedAt(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function formatAuthorLabel(authorSlug: string | null) {
  if (!authorSlug) return '编辑部'
  if (authorSlug === 'rafa') return 'RAFA'
  return authorSlug
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!post) notFound()

  const contentTypeLabel = getTypeLabel(post.content_type)
  const authorLabel = post.author_display ?? formatAuthorLabel(post.author_slug)
  const headings = extractHeadings(post.content)

  const header = (
    <>
      <div className="mb-12">
        <BackButton />
      </div>

      <header className="mb-14 pb-10 border-b border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <span className="kicker" style={{ color: 'var(--accent)' }}>{contentTypeLabel}</span>
          <span className="kicker text-[var(--subtle)]">·</span>
          <span className="kicker">{authorLabel}</span>
          <span className="kicker text-[var(--subtle)]">·</span>
          <span className="kicker">{formatPublishedAt(post.published_at)}</span>
        </div>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-[3.5rem] font-medium leading-[1.15] tracking-tight text-[var(--foreground)]">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-8 text-lg md:text-xl text-[var(--muted)] leading-relaxed">{post.excerpt}</p>
        )}
      </header>
    </>
  )

  const share = (
    <WechatShare
      title={post.title}
      description={post.excerpt ?? ''}
      imageUrl={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai.air7.fun'}/post/${post.slug}/opengraph-image`}
    />
  )

  return (
    <article>
      <ArticleToc headings={headings} />
      <ArticleChatPanel slug={post.slug} title={post.title}>
        {header}
        <MermaidContent className="prose" html={post.content} />
        {share}
      </ArticleChatPanel>
    </article>
  )
}
