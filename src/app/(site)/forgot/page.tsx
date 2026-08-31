'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setStatus('done')
  }

  if (status === 'done') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>邮件已发送</p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
            检查你的收件箱
          </h1>
          <p className="mt-6 text-[var(--muted)] leading-relaxed">
            如果该邮箱已注册，你将收到一封重置密码的邮件。请在 1 小时内完成重置。
          </p>
          <div className="mt-10">
            <Link href="/login" className="kicker hover:text-[var(--accent)] transition-colors">
              返回登录 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="kicker mb-4" style={{ color: 'var(--accent)' }}>Reset password</p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
            忘记密码了？
          </h1>
          <p className="mt-5 text-[var(--muted)] leading-relaxed">
            输入注册邮箱，我们会给你发一个重置链接。
          </p>
        </div>

        <div className="bg-[var(--background)] rounded-2xl p-8 shadow-[0_0_0_1px_var(--border-subtle),0_4px_24px_rgba(20,20,19,0.04)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="注册邮箱"
              className="w-full border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base rounded-xl outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.15)] transition placeholder:text-[var(--subtle)]"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-[var(--accent)] text-[#faf9f5] py-3 text-base font-medium rounded-xl hover:bg-[var(--accent-coral)] transition-colors disabled:opacity-50 shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
            >
              {status === 'loading' ? '发送中...' : '发送重置邮件'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            <Link href="/login" className="hover:text-[var(--accent)] transition-colors">
              返回登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
