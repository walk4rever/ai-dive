import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import 'katex/dist/katex.min.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI-DIVE | 学习 AI，从知道，到做到',
  description: '每周精选真正重要的 AI 变化与判断：情报、深度、访谈、专题，陪你从知道走到做到。',
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
