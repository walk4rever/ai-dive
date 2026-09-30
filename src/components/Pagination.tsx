import Link from 'next/link'

interface PaginationProps {
  currentPage: number
  totalPages: number
  total: number
  basePath: string
  queryParams?: Record<string, string>
}

export function Pagination({ currentPage, totalPages, total, basePath, queryParams = {} }: PaginationProps) {
  const hasPrevPage = currentPage > 1
  const hasNextPage = currentPage < totalPages

  function buildPageUrl(page: number): string {
    const params = new URLSearchParams(queryParams)
    if (page > 1) params.set('page', String(page))
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  if (totalPages <= 1) return null

  return (
    <div className="py-8 flex items-center justify-center gap-4">
      {hasPrevPage ? (
        <Link
          href={buildPageUrl(currentPage - 1)}
          className="px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
        >
          ← 上一页
        </Link>
      ) : (
        <span className="px-4 py-2 text-sm font-medium text-[var(--muted)] border border-[var(--border-subtle)] rounded-md cursor-not-allowed opacity-50">
          ← 上一页
        </span>
      )}

      <span className="text-sm text-[var(--muted)]">
        共 {total} 篇 · 第 {currentPage} / {totalPages} 页
      </span>

      {hasNextPage ? (
        <Link
          href={buildPageUrl(currentPage + 1)}
          className="px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
        >
          下一页 →
        </Link>
      ) : (
        <span className="px-4 py-2 text-sm font-medium text-[var(--muted)] border border-[var(--border-subtle)] rounded-md cursor-not-allowed opacity-50">
          下一页 →
        </span>
      )}
    </div>
  )
}
