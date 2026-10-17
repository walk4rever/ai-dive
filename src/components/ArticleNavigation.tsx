import Link from 'next/link'
import type { ArticleNavigationData } from '@/lib/article-navigation'

interface ArticleNavigationProps {
  navigation: ArticleNavigationData
}

export function ArticleNavigation({ navigation }: ArticleNavigationProps) {
  return (
    <nav aria-label="文章导航" className="mt-20 border-t border-[var(--border)] pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <p className="kicker" style={{ color: 'var(--accent)' }}>{navigation.heading}</p>
        {navigation.position && <p className="date">{navigation.position}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {navigation.previous ? (
          <Link
            href={`/post/${navigation.previous.slug}`}
            className="group flex min-h-[92px] flex-col justify-between rounded-[var(--radius-md)] border border-[var(--border)] p-4 transition-colors hover:border-[var(--accent)]"
          >
            <span className="kicker">← {navigation.previousLabel}</span>
            <span className="mt-4 font-serif text-base leading-snug transition-colors group-hover:text-[var(--accent)]">
              {navigation.previous.title}
            </span>
          </Link>
        ) : (
          <div aria-hidden="true" />
        )}

        {navigation.next ? (
          <Link
            href={`/post/${navigation.next.slug}`}
            className="group flex min-h-[92px] flex-col justify-between rounded-[var(--radius-md)] border border-[var(--border)] p-4 transition-colors hover:border-[var(--accent)] sm:text-right"
          >
            <span className="kicker">{navigation.nextLabel} →</span>
            <span className="mt-4 font-serif text-base leading-snug transition-colors group-hover:text-[var(--accent)]">
              {navigation.next.title}
            </span>
          </Link>
        ) : (
          <div aria-hidden="true" />
        )}
      </div>

      <div className="mt-5">
        <Link
          href={navigation.allHref}
          className="kicker transition-colors hover:text-[var(--accent)]"
        >
          {navigation.allLabel} →
        </Link>
      </div>
    </nav>
  )
}
