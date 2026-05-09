import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getWikiPage,
  getWikiPages,
  WIKI_CATEGORIES,
  CATEGORY_LABELS,
  formatWikiDate,
  type WikiCategory,
} from '@/lib/wiki'
import { WikiToc } from '@/components/wiki/WikiToc'
import { WikiCard } from '@/components/wiki/WikiCard'
import { MermaidContent } from '@/components/MermaidContent'

interface Props {
  params: Promise<{ category: string; slug: string }>
}

export async function generateStaticParams() {
  const pages = await getWikiPages()
  return pages.map((p) => ({ category: p.category, slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  if (!WIKI_CATEGORIES.includes(category as WikiCategory)) return {}
  const page = await getWikiPage(category as WikiCategory, slug)
  if (!page) return {}
  return {
    title: `${page.frontmatter.title} · Wiki · AI-DIVE`,
    description: page.excerpt,
  }
}

export const revalidate = 3600

export default async function WikiArticlePage({ params }: Props) {
  const { category, slug } = await params

  if (!WIKI_CATEGORIES.includes(category as WikiCategory)) notFound()

  const page = await getWikiPage(category as WikiCategory, slug)
  if (!page) notFound()

  const { frontmatter, html, toc, backlinks } = page
  const date = formatWikiDate(frontmatter.updated ?? frontmatter.created)

  return (
    <div className="py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[var(--subtle)] mb-8">
        <Link href="/wiki" className="hover:text-[var(--accent)] transition-colors">
          Wiki
        </Link>
        <span>/</span>
        <Link
          href={`/wiki?category=${category}`}
          className="hover:text-[var(--accent)] transition-colors"
        >
          {CATEGORY_LABELS[category as WikiCategory]}
        </Link>
        <span>/</span>
        <span className="text-[var(--muted)] truncate max-w-[200px]">{frontmatter.title}</span>
      </nav>

      <div className="lg:grid lg:grid-cols-[1fr_200px] lg:gap-12 lg:-mr-8">
        {/* Article */}
        <article>
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[var(--surface-sand)] text-[var(--muted)]">
                {CATEGORY_LABELS[category as WikiCategory]}
              </span>
              {date && (
                <span className="text-xs text-[var(--subtle)]">更新于 {date}</span>
              )}
            </div>
            <h1 className="font-serif text-2xl font-medium text-[var(--foreground)] leading-snug mb-4">
              {frontmatter.title}
            </h1>
            {frontmatter.tags && frontmatter.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {frontmatter.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-[var(--subtle)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Mobile TOC */}
          {toc.length > 0 && (
            <div className="lg:hidden mb-8 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <WikiToc items={toc} />
            </div>
          )}

          {/* Content */}
          <MermaidContent
            html={html}
            className="prose"
          />

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <section className="mt-12 pt-8 border-t border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--foreground-soft)] uppercase tracking-wide mb-5">
                反向链接
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {backlinks.map((bl) => (
                  <WikiCard key={`${bl.category}/${bl.slug}`} page={bl} />
                ))}
              </div>
            </section>
          )}
        </article>

        {/* Desktop TOC Sidebar */}
        {toc.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <WikiToc items={toc} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
