'use client'

import Link from 'next/link'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const inputClass =
  'w-full border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base rounded-xl outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.15)] transition placeholder:text-[var(--subtle)]'

const primaryButtonClass =
  'w-full bg-[var(--accent)] text-[#faf9f5] py-3 text-base font-medium rounded-xl hover:bg-[var(--accent-coral)] transition-colors disabled:opacity-50 shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]'

function ResetForm() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const nonce = searchParams.get('nonce') ?? ''
  const invalidLink = !email || !nonce

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (invalidLink) {
      setStatus('error')
      setMessage('链接无效，请重新申请。')
      return
    }
    if (password !== confirm) {
      setStatus('error')
      setMessage('两次密码不一致')
      return
    }
    setStatus('loading')
    setMessage('')

    const res = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nonce, new_password: password }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus('success')
    } else {
      setStatus('error')
      setMessage(data.error || '重置失败，请重新申请。')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>密码已重置</p>
        <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
          可以用新密码登录了
        </h1>
        <div className="mt-10">
          <Link
            href="/login"
            className="inline-flex items-center bg-[var(--accent)] text-[#faf9f5] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--accent-coral)] transition-colors shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
          >
            前往登录 →
          </Link>
        </div>
      </div>
    )
  }

  if (invalidLink) {
    return (
      <div className="text-center">
        <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>链接无效</p>
        <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
          这个重置链接不对
        </h1>
        <p className="mt-6 text-[var(--muted)]">可能是已过期或被点击过。</p>
        <div className="mt-10">
          <Link href="/forgot" className="kicker hover:text-[var(--accent)] transition-colors">
            重新申请 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-10">
        <p className="kicker mb-4" style={{ color: 'var(--accent)' }}>New password</p>
        <h1 className="font-serif text-3xl md:text-4xl font-medium leading-[1.15] tracking-tight">
          设置新密码
        </h1>
      </div>
      <div className="bg-[var(--background)] rounded-2xl p-8 shadow-[0_0_0_1px_var(--border-subtle),0_4px_24px_rgba(20,20,19,0.04)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（至少 8 位）"
            className={inputClass}
          />
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="确认新密码"
            className={inputClass}
          />
          {status === 'error' && message && (
            <p className="text-sm text-[var(--error)]">{message}</p>
          )}
          <button type="submit" disabled={status === 'loading'} className={primaryButtonClass}>
            {status === 'loading' ? '处理中...' : '确认重置'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <Suspense fallback={<p className="text-sm text-[var(--muted)] text-center">加载中...</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
