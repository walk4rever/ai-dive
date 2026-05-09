import { createClient } from '@/lib/supabase/server'
import { getTypeLabel } from '@/lib/content'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'
import { MermaidContent } from '@/components/MermaidContent'
import { WechatShare } from '@/components/WechatShare'

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
      siteName: 'AI早知道',
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
  const authorLabel = formatAuthorLabel(post.author_slug)

  return (
    <article className="max-w-2xl mx-auto">
      <div className="mb-12">
        <BackButton />
      </div>

      <header className="mb-14 pb-10 border-b border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <span className="kicker" style={{ color: 'var(--accent)' }}>{contentTypeLabel}</span>
          {post.is_premium && <span className="kicker">付费内容</span>}
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

      {post.is_premium ? (
        <PremiumPaywall excerpt={post.excerpt} />
      ) : (
        <MermaidContent className="prose" html={post.content} />
      )}

      <WechatShare
        title={post.title}
        description={post.excerpt ?? ''}
        imageUrl={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai.air7.fun'}/post/${post.slug}/opengraph-image`}
      />
    </article>
  )
}

function PremiumPaywall({ excerpt }: { excerpt: string }) {
  return (
    <div>
      <MermaidContent className="prose" html={excerpt} />
      <div className="relative mt-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent to-[var(--background)]" />
        <div className="mt-8 bg-[var(--background)] border border-[var(--border-subtle)] rounded-2xl px-8 py-10 text-center shadow-[0_4px_24px_rgba(20,20,19,0.05)]">
          <p className="kicker mb-4" style={{ color: 'var(--accent)' }}>Members Edition</p>
          <h3 className="font-serif text-2xl md:text-3xl font-medium leading-tight tracking-tight">
            订阅以阅读完整内容
          </h3>
          <p className="mt-4 text-[var(--muted)] leading-relaxed max-w-md mx-auto">
            加入 AI早知道 的读者名单，每周获取更完整的深度分析与长期判断。
          </p>
          <div className="mt-8">
            <Link
              href="/subscribe"
              className="inline-flex items-center bg-[var(--accent)] text-[#faf9f5] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--accent-coral)] transition-colors shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
            >
              免费订阅 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
