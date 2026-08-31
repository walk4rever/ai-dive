import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { NavUser } from '@/components/NavUser'
import { NavLinks } from '@/components/NavLinks'

/** The public-site header/nav/footer, extracted from the root layout so it can be
 *  used in two places: `(site)/layout.tsx` (the normal case — everything under it
 *  gets this for free) and the root-level not-found/error boundaries, which render
 *  OUTSIDE `(site)/layout.tsx` for a genuinely unmatched top-level path and so don't
 *  inherit it automatically (Next.js only wraps a not-found/error file in the layouts
 *  it's physically nested under). `/admin` does not use this — it has its own chrome. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl bg-[var(--background)]">
      <header>
        <div className="px-5 md:px-6 py-6 md:py-12">
          <div className="flex items-center justify-between md:grid md:grid-cols-3">
            <Link href="/" className="block">
              <Logo />
            </Link>
            <NavLinks variant="desktop" />
            <div className="flex items-center justify-end gap-3 md:gap-4">
              <NavUser />
            </div>
          </div>
          <NavLinks variant="mobile" />
        </div>
      </header>

      <main className="px-6 pb-20">{children}</main>

      <footer className="mt-24 border-t border-[var(--border)]">
        <div className="px-5 md:px-6 py-10 md:py-14">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--subtle)]">AI-DIVE © 2026 · Powered by Air7.fun</p>
            <nav className="flex items-center gap-6 text-sm">
              <Link
                href="/docs"
                className="font-medium text-[var(--foreground-soft)] hover:text-[var(--accent)] transition-colors"
              >
                API
              </Link>
              <a
                href="mailto:walkklaw@gmail.com"
                className="font-medium text-[var(--foreground-soft)] hover:text-[var(--accent)] transition-colors"
              >
                联系
              </a>
              <Link
                href="/subscribe"
                className="font-medium text-[var(--foreground-soft)] hover:text-[var(--accent)] transition-colors"
              >
                订阅
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
