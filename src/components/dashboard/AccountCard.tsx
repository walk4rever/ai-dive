'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

interface AccountCardProps {
  email: string
  username: string
  className?: string
}

type Status = 'idle' | 'loading' | 'error' | 'success'

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--subtle)] focus:border-[var(--foreground)]'

const submitClass =
  'w-full rounded-[var(--radius-md)] bg-[var(--foreground)] py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-80 disabled:opacity-50'

/** One row of the account panel: label + current value on the left, a toggle on the
 *  right, and the form itself unfolding underneath — so the card reads as a summary
 *  until you actually want to change something. */
function Row({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string
  value: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">{value}</p>
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
        >
          {open ? '取消' : '修改'}
        </button>
      </div>
      {open && <div className="mt-5">{children}</div>}
    </div>
  )
}

function Message({ status, text }: { status: Status; text: string }) {
  if (!text) return null
  return (
    <p className={`text-xs ${status === 'success' ? 'text-[var(--muted)]' : 'text-[var(--accent)]'}`}>{text}</p>
  )
}

export function AccountCard({ email, username: initialUsername, className = '' }: AccountCardProps) {
  const [username, setUsername] = useState(initialUsername)

  const [showUsername, setShowUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<Status>('idle')
  const [usernameMsg, setUsernameMsg] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwStatus, setPwStatus] = useState<Status>('idle')
  const [pwMsg, setPwMsg] = useState('')

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault()
    setUsernameStatus('loading')
    setUsernameMsg('')

    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername }),
    })
    const data = await res.json()

    if (res.ok) {
      setUsername(data.username)
      setUsernameStatus('success')
      setUsernameMsg('用户名已更新。')
      setNewUsername('')
    } else {
      setUsernameStatus('error')
      setUsernameMsg(data.error || '修改失败')
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwStatus('loading')
    setPwMsg('')

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    })
    const data = await res.json()

    if (res.ok) {
      setPwStatus('success')
      setPwMsg('密码已更新。')
      setCurrentPw('')
      setNewPw('')
    } else {
      setPwStatus('error')
      setPwMsg(data.error || '修改失败')
    }
  }

  return (
    <Card kicker="账号" className={className}>
      <div className="mt-2 divide-y divide-[var(--border-subtle)]">
        <div className="py-4">
          <p className="text-sm font-medium">邮箱</p>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">{email}</p>
        </div>

        <Row
          label="用户名"
          value={username || '未设置'}
          open={showUsername}
          onToggle={() => { setShowUsername(!showUsername); setUsernameStatus('idle'); setUsernameMsg('') }}
        >
          <form onSubmit={handleChangeUsername} className="space-y-3">
            <input
              type="text"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
              placeholder="新用户名"
              minLength={3}
              maxLength={30}
              className={inputClass}
            />
            <p className="text-xs leading-relaxed text-[var(--subtle)]">
              3–30 字符，字母、数字、连字符（-）。以用户身份发布文章时，它就是文章上的署名。
            </p>
            <Message status={usernameStatus} text={usernameMsg} />
            <button type="submit" disabled={usernameStatus === 'loading'} className={submitClass}>
              {usernameStatus === 'loading' ? '处理中...' : '确认修改'}
            </button>
          </form>
        </Row>

        <Row
          label="密码"
          value="••••••••"
          open={showPassword}
          onToggle={() => { setShowPassword(!showPassword); setPwStatus('idle'); setPwMsg('') }}
        >
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="当前密码"
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="新密码（至少 8 位）"
              className={inputClass}
            />
            <Message status={pwStatus} text={pwMsg} />
            <button type="submit" disabled={pwStatus === 'loading'} className={submitClass}>
              {pwStatus === 'loading' ? '处理中...' : '确认修改'}
            </button>
          </form>
        </Row>
      </div>
    </Card>
  )
}
