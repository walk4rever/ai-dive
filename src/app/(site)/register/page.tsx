'use client'

import Link from 'next/link'
import { useState } from 'react'

const inputClass =
  'w-full border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base rounded-xl outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.15)] transition placeholder:text-[var(--subtle)]'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus('success')
    } else {
      setStatus('error')
      setMessage(data.error || '注册失败，请稍后重试。')
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>验证邮件已发送</p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
            检查你的收件箱
          </h1>
          <p className="mt-6 text-[var(--muted)] leading-relaxed">
            请查收 <span className="text-[var(--foreground)]">{email}</span> 的邮件，点击链接完成验证后即可登录。
          </p>
          <div className="mt-10">
            <Link href="/login" className="kicker hover:text-[var(--accent)] transition-colors">
              前往登录 →
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
          <p className="kicker mb-4" style={{ color: 'var(--accent)' }}>Sign up</p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
            创建账号
          </h1>
        </div>

        <div className="bg-[var(--background)] rounded-2xl p-8 shadow-[0_0_0_1px_var(--border-subtle),0_4px_24px_rgba(20,20,19,0.04)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className={inputClass}
            />
            <div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                placeholder="用户名（字母、数字、连字符）"
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9-]{3,30}"
                className={inputClass}
              />
              <p className="mt-2 text-xs text-[var(--muted)]">用于文章署名，注册后可修改</p>
            </div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 8 位）"
              className={inputClass}
            />

            {status === 'error' && (
              <p className="text-sm text-[var(--error)]">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-[var(--accent)] text-[#faf9f5] py-3 text-base font-medium rounded-xl hover:bg-[var(--accent-coral)] transition-colors disabled:opacity-50 shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
            >
              {status === 'loading' ? '处理中...' : '注册'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            已有账号？{' '}
            <Link href="/login" className="text-[var(--foreground)] font-medium hover:text-[var(--accent)] transition-colors">
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
