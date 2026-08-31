import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import 'katex/dist/katex.min.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI-DIVE | 面向 AI 工程师的周刊与深度研究',
  description: '不是追所有 AI 新闻，而是解释真正重要的变化。给 AI 工程师的每周精选、深度分析与长期判断。',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
}

/** Bare shell shared by every route: (site) and (admin) each bring their own chrome
 *  via their own nested layout. Providers (next-auth SessionProvider) has to live
 *  here rather than in either group's layout — both the site nav and the admin
 *  console call useSession()/signOut(). */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
