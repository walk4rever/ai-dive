'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/admin', label: '总览' },
  { href: '/admin/posts', label: '文章' },
  { href: '/admin/decks', label: '出品' },
  { href: '/admin/users', label: '用户' },
  { href: '/admin/subscribers', label: '订阅' },
  { href: '/admin/series', label: '专题' },
  { href: '/admin/upload', label: '上传' },
]

function isActive(pathname: string | null, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname?.startsWith(`${href}/`) === true
}

/** Chrome for every /admin page: a left nav on desktop (top horizontal scroll on
 *  mobile, same idiom as the public site's NavLinks) plus a header with the actions
 *  that used to be duplicated inside AdminConsoleClient's own header. `(admin)/layout.tsx`
 *  does the session/role check once and renders this around `children` — individual
 *  pages no longer each carry their own `min-h-screen p-8` wrapper or auth redirect. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-6 pb-6 mb-6 border-b border-[var(--border)]">
          <div>
            <p className="kicker mb-2" style={{ color: 'var(--accent)' }}>Admin Console</p>
            <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight">管理后台</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)] hover:text-[var(--accent)]"
            >
              首页
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)] hover:text-[var(--accent)]"
            >
              退出
            </button>
          </div>
        </header>

        {/* Mobile nav — horizontal scroll, matches the public site's NavLinks idiom */}
        <nav className="md:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 mb-6 flex items-center gap-5 overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium whitespace-nowrap pb-1 border-b-2 transition-colors ${
                  active
                    ? 'border-[var(--accent)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="md:grid md:grid-cols-[160px_1fr] md:gap-8">
          <nav className="hidden md:flex md:flex-col md:gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-[var(--border-subtle)] font-medium text-[var(--foreground)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
