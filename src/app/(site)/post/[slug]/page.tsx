import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getTypeLabel, getSourceLabel } from '@/lib/content'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'
import { ArticleNavigation } from '@/components/ArticleNavigation'
import { MermaidContent } from '@/components/MermaidContent'
import { AiChatPanel } from '@/components/AiChatPanel'
import { ArticleToc } from '@/components/ArticleToc'
import { BackToTop } from '@/components/BackToTop'
import {
  buildColumnNavigation,
  buildTopicNavigation,
  type ArticleNavigationData,
} from '@/lib/article-navigation'
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
  const sourceLabel = getSourceLabel(post.source) ?? '编辑部'
  const authorLabel = post.author?.trim() || null
  const headings = extractHeadings(post.content)
  let navigation: ArticleNavigationData | null = null

  if (post.content_type === 'dive') {
    const navSupabase = await createServiceClient()

    if (post.topic_id) {
      const [{ data: topic }, { data: topicStories }] = await Promise.all([
        navSupabase
          .from('ai_pulse_topics')
          .select('id, name')
          .eq('id', post.topic_id)
          .maybeSingle(),
        navSupabase
          .from('ai_pulse_stories')
          .select('id, slug, title, topic_order')
          .eq('status', 'published')
          .eq('topic_id', post.topic_id)
          .order('topic_order', { ascending: true })
          .order('id', { ascending: true }),
      ])

      if (topic) {
        navigation = buildTopicNavigation(topicStories ?? [], post.id, topic)
      }
    }

    if (!navigation) {
      const { data: columnStories } = await navSupabase
        .from('ai_pulse_stories')
        .select('id, slug, title, published_at, created_at')
        .eq('status', 'published')
        .eq('content_type', post.content_type)
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      navigation = buildColumnNavigation(
        columnStories ?? [],
        post.id,
        post.content_type,
        contentTypeLabel
      )
    }
  }

  const header = (
    <>
      <div className="mb-12">
        <BackButton />
      </div>

      <header className="mb-14 pb-10 border-b border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <span className="kicker" style={{ color: 'var(--accent)' }}>{contentTypeLabel}</span>
          <span className="kicker text-[var(--subtle)]">·</span>
          <span className="kicker">{sourceLabel}</span>
          {authorLabel && (
            <>
              <span className="kicker text-[var(--subtle)]">·</span>
              <span className="kicker">{authorLabel}</span>
            </>
          )}
          <span className="kicker text-[var(--subtle)]">·</span>
          <span className="kicker">{formatPublishedAt(post.published_at)}</span>
          {post.source_url && (
            <>
              <span className="kicker text-[var(--subtle)]">·</span>
              <a
                href={post.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="kicker text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              >
                阅读原文 ↗
              </a>
            </>
          )}
        </div>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.15] tracking-tight text-[var(--foreground)]">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-8 text-lg md:text-xl text-[var(--muted)] leading-relaxed">{post.excerpt}</p>
        )}
      </header>
    </>
  )

  return (
    <article>
      <ArticleToc headings={headings} />
      {post.content_type === 'dive' && <BackToTop />}
      <AiChatPanel
        pageContext={{ kind: 'article', id: post.slug }}
        title={post.title}
        author={sourceLabel}
      >
        {header}
        <MermaidContent className="prose" html={post.content} />
        {navigation && <ArticleNavigation navigation={navigation} />}
      </AiChatPanel>
    </article>
  )
}
