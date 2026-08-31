'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function SubscribePage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus('success')
      setMessage(data.message)
    } else {
      setStatus('error')
      setMessage(data.error || '订阅失败，请稍后重试。')
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <p className="kicker mb-6" style={{ color: 'var(--accent)' }}>已发送确认邮件</p>
          <h1 className="font-serif text-4xl md:text-5xl font-medium leading-[1.15] tracking-tight">
            请查收确认邮件
          </h1>
          <p className="mt-8 text-lg text-[var(--muted)] leading-relaxed max-w-md mx-auto">{message}</p>
          <div className="mt-10">
            <Link href="/" className="kicker hover:text-[var(--accent)] transition-colors">
              ← 返回首页
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-12">
        <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>Subscribe</p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium leading-[1.15] tracking-tight">
          订阅 AI-DIVE
        </h1>
        <p className="mt-6 text-lg md:text-xl text-[var(--muted)] leading-relaxed max-w-xl">
          每周一次，一封面向 AI 工程师的研究型简报：筛掉噪音，只留下真正重要的变化与判断。完全免费。
        </p>
      </header>

      <div className="bg-[var(--background)] rounded-2xl p-8 md:p-10 shadow-[0_0_0_1px_var(--border-subtle),0_4px_24px_rgba(20,20,19,0.04)]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="kicker block mb-3">邮箱</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.15)] placeholder:text-[var(--subtle)] rounded-xl"
            />
          </div>

          {status === 'error' && (
            <p className="text-sm text-[var(--error)]">{message}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-[var(--accent)] text-[#faf9f5] py-3.5 text-base font-medium rounded-xl hover:bg-[var(--accent-coral)] transition-colors disabled:opacity-50 shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
          >
            {status === 'loading' ? '处理中...' : '免费订阅'}
          </button>
        </form>

        <p className="kicker mt-6 text-center">订阅即表示同意接收邮件 · 随时可以取消</p>
      </div>
    </div>
  )
}
