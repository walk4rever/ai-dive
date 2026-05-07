'use client'

import Link from 'next/link'
import { useEffect } from 'react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Surface to server logs for debugging
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-center">
      <div className="max-w-md">
        <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>Something broke</p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium leading-[1.15] tracking-tight">
          出了点问题
        </h1>
        <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed">
          页面遇到了一个异常。可以重试一次，或者先回首页。
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            onClick={reset}
            className="inline-flex items-center bg-[var(--accent)] text-[#faf9f5] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--accent-coral)] transition-colors shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
          >
            重试
          </button>
          <Link
            href="/"
            className="inline-flex items-center bg-[var(--surface-sand)] text-[var(--charcoal)] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--border)] transition-colors shadow-[0_0_0_1px_var(--ring)]"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  )
}
