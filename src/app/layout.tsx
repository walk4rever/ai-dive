import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { NavUser } from '@/components/NavUser'
import { NavLinks } from '@/components/NavLinks'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI-DIVE | 面向 AI 工程师的周刊与深度研究',
  description: '不是追所有 AI 新闻，而是解释真正重要的变化。给 AI 工程师的每周精选、深度分析与长期判断。',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <div className="mx-auto max-w-5xl bg-[var(--background)]">
        <header>
          <div className="px-5 md:px-6 py-6 md:py-12">
            {/* Top row: logo + actions (mobile: flex, desktop: grid cols 3 with centered nav) */}
            <div className="flex items-center justify-between md:grid md:grid-cols-3">
              <Link href="/" className="block">
                <Logo />
              </Link>
              {/* Desktop nav — center column */}
              <NavLinks variant="desktop" />
              <div className="flex items-center justify-end gap-3 md:gap-4">
                <NavUser />
              </div>
            </div>

            {/* Mobile nav — second row, horizontal scrollable */}
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
      </body>
    </html>
  )
}
