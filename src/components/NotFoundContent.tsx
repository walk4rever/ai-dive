import Link from 'next/link'

/** Shared by two not-found.tsx files: `(site)/not-found.tsx` (wrapped in site chrome
 *  automatically via that group's layout) and the root `app/not-found.tsx` (which
 *  catches a genuinely unmatched top-level path — one that doesn't resolve to any
 *  route segment at all, not even within (site) — and so isn't nested under (site)'s
 *  layout; it wraps this in <SiteChrome> itself). Keeping the markup here means the
 *  two boundaries can't drift out of sync. */
export function NotFoundContent() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-center">
      <div className="max-w-md">
        <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>404 · Not found</p>
        <h1 className="font-serif text-5xl md:text-6xl font-medium leading-[1.1] tracking-tight">
          这里没有东西
        </h1>
        <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed">
          你要找的页面可能被删除、重命名了，或者从没存在过。
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center bg-[var(--accent)] text-[#faf9f5] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--accent-coral)] transition-colors shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
          >
            返回首页
          </Link>
          <Link
            href="/archive"
            className="inline-flex items-center bg-[var(--surface-sand)] text-[var(--charcoal)] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--border)] transition-colors shadow-[0_0_0_1px_var(--ring)]"
          >
            浏览全部文章
          </Link>
        </div>
      </div>
    </div>
  )
}
