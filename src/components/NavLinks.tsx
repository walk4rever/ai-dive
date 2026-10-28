'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { loginHref } from '@/lib/auth/client'

interface NavItem {
  href: string
  label: string
  gated?: boolean
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: '/intels', label: '情报' },
  { href: '/dives', label: '深度' },
  { href: '/series', label: '专题' },
  { href: '/agent', label: '探索', gated: true },
  { href: '/decks', label: '出品' },
]

interface NavLinksProps {
  variant: 'desktop' | 'mobile'
}

export function NavLinks({ variant }: NavLinksProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { status } = useSession()
  const isDesktop = variant === 'desktop'
  const containerClass = isDesktop
    ? 'hidden md:flex items-center justify-center gap-5'
    : 'md:hidden mt-5 -mx-5 px-5 flex items-center gap-5 overflow-x-auto scrollbar-hide'

  return (
    <nav className={containerClass}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const base =
          'text-sm font-medium transition-colors whitespace-nowrap relative pb-1'
        const color = active
          ? 'text-[var(--foreground)]'
          : 'text-[var(--foreground-soft)] hover:text-[var(--foreground)]'
        const handleClick = item.gated
          ? (e: React.MouseEvent) => {
              if (status !== 'authenticated') {
                e.preventDefault()
                router.push(loginHref(item.href))
              }
            }
          : undefined

        return (
          <Link key={item.href} href={item.href} onClick={handleClick} className={`${base} ${color}`}>
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
