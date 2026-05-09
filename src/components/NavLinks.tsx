'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/intel', label: '情报' },
  { href: '/analysis', label: '深度' },
  { href: '/cases', label: '案例' },
  { href: '/invest', label: '投资' },
  { href: '/podcast', label: '播客' },
  { href: '/series', label: '专题' },
]

interface NavLinksProps {
  variant: 'desktop' | 'mobile'
}

export function NavLinks({ variant }: NavLinksProps) {
  const pathname = usePathname()
  const isDesktop = variant === 'desktop'
  const containerClass = isDesktop
    ? 'hidden md:flex items-center justify-center gap-7'
    : 'md:hidden mt-5 -mx-5 px-5 flex items-center gap-7 overflow-x-auto scrollbar-hide'

  return (
    <nav className={containerClass}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const base =
          'text-sm font-medium transition-colors whitespace-nowrap relative pb-1'
        const color = active
          ? 'text-[var(--foreground)]'
          : 'text-[var(--foreground-soft)] hover:text-[var(--foreground)]'
        return (
          <Link key={item.href} href={item.href} className={`${base} ${color}`}>
            {item.label}
            {active && (
              <span
                aria-hidden
                className="absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full bg-[var(--accent)]"
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
