'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { sanitizeNext } from '@/lib/auth/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const res = await signIn('credentials', { email, password, redirect: false })

    if (res?.error) {
      setStatus('error')
      setMessage('邮箱或密码错误，请重试。')
    } else {
      const next = sanitizeNext(new URLSearchParams(window.location.search).get('next'))
      router.push(next ?? '/dashboard')
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="kicker mb-4" style={{ color: 'var(--accent)' }}>Sign in</p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
            欢迎回来
          </h1>
          <p className="mt-4 text-[var(--muted)] leading-relaxed">
            登录后解锁探索 Agent、AI解读等更多 AI+ 功能
          </p>
        </div>

        <div className="bg-[var(--background)] rounded-2xl p-8 shadow-[0_0_0_1px_var(--border-subtle),0_4px_24px_rgba(20,20,19,0.04)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className="w-full border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base rounded-xl outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.15)] transition placeholder:text-[var(--subtle)]"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              className="w-full border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base rounded-xl outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.15)] transition placeholder:text-[var(--subtle)]"
            />

            {status === 'error' && (
              <p className="text-sm text-[var(--error)]">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-[var(--accent)] text-[#faf9f5] py-3 text-base font-medium rounded-xl hover:bg-[var(--accent-coral)] transition-colors disabled:opacity-50 shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
            >
              {status === 'loading' ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link href="/forgot" className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              忘记密码
            </Link>
            <Link href="/register" className="text-[var(--foreground)] font-medium hover:text-[var(--accent)] transition-colors">
              注册账号 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
