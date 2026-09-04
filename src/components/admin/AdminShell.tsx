'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Logo } from '@/components/Logo'

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/admin', label: '总览' },
  { href: '/admin/posts', label: '文章' },
  { href: '/admin/decks', label: '出品' },
  { href: '/admin/users', label: '用户' },
  { href: '/admin/subscribers', label: '订阅' },
  { href: '/admin/newsletter', label: '周刊' },
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
  const { data: session } = useSession()

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="hover:opacity-85 transition-opacity" title="返回前台首页">
              <Logo size={22} showWordmark={true} />
            </Link>
            <span className="text-[var(--ring)] select-none font-light">/</span>
            <span className="text-[11px] px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-sand)] text-[var(--foreground-soft)] font-mono font-medium tracking-wide">
              ADMIN
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {session?.user?.email && (
              <span className="hidden sm:inline-block text-xs text-[var(--muted)] font-mono">
                {session.user.email}
              </span>
            )}
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)] hover:text-[var(--accent)]"
              title="在新标签页中打开站点"
            >
              <span>查看站点</span>
              <span aria-hidden className="text-[10px]">↗</span>
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--ring)] hover:text-[var(--error)]"
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
