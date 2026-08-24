'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

export interface Agent {
  id: string
  name: string
  status: string
  created_at: string
}

interface DashboardClientProps {
  email: string
  username: string
  isAdmin: boolean
  initialAgents: Agent[]
}

function formatDate(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function DashboardClient({ email, username: initialUsername, isAdmin, initialAgents }: DashboardClientProps) {
  const router = useRouter()
  const [username, setUsername] = useState(initialUsername)
  const [agents, setAgents] = useState<Agent[]>(initialAgents)

  // New agent
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Displayed key (create or rotate)
  const [shownKey, setShownKey] = useState<{ agentName: string; key: string } | null>(null)

  // Change username
  const [showChangeUsername, setShowChangeUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [usernameMsg, setUsernameMsg] = useState('')

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [changePwStatus, setChangePwStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [changePwMsg, setChangePwMsg] = useState('')

  async function refreshAgents() {
    const res = await fetch('/api/agents')
    if (!res.ok) return
    const data = await res.json()
    setAgents(data.agents ?? [])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setCreateError('')
    setShownKey(null)

    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()

    if (res.ok) {
      setShownKey({ agentName: data.agent.name, key: data.api_key })
      setNewName('')
      await refreshAgents()
    } else {
      setCreateError(data.error || '创建失败')
    }
    setCreating(false)
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`确认撤销 Agent「${name}」的 Key？此操作不可恢复。`)) return
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    if (res.ok) await refreshAgents()
  }

  async function handleRotate(id: string, name: string) {
    if (!confirm(`重新生成「${name}」的 Key？旧 Key 立即失效。`)) return
    setShownKey(null)
    const res = await fetch(`/api/agents/${id}/rotate`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setShownKey({ agentName: name, key: data.api_key })
  }

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
    setChangePwStatus('loading')
    setChangePwMsg('')

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    })
    const data = await res.json()

    if (res.ok) {
      setChangePwStatus('success')
      setChangePwMsg('密码已更新。')
      setCurrentPw('')
      setNewPw('')
    } else {
      setChangePwStatus('error')
      setChangePwMsg(data.error || '修改失败')
    }
  }

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const activeAgents = agents.filter((a) => a.status === 'active')

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div>
          <p className="kicker">控制台</p>
          <p className="text-sm text-[var(--muted)] mt-1">{email}</p>
        </div>
        <div className="flex items-center gap-5">
          <a href="/my/posts" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            我的文章
          </a>
          {isAdmin && (
            <a href="/admin" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              管理后台
            </a>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>

      {/* Key banner */}
      {shownKey && (
        <div className="mb-10 border border-[var(--foreground)] p-5">
          <p className="kicker mb-2">「{shownKey.agentName}」的 API Key</p>
          <p className="text-xs text-[var(--muted)] mb-3">仅显示一次，请立即复制保存。</p>
          <code className="block text-sm break-all bg-[var(--border-subtle)] px-3 py-2 select-all">
            {shownKey.key}
          </code>
          <button
            onClick={() => setShownKey(null)}
            className="mt-4 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            已保存，关闭
          </button>
        </div>
      )}

      {/* Agent list */}
      <section className="mb-12">
        <p className="kicker mb-2">我的 Agent</p>
        <p className="text-sm text-[var(--muted)] mb-6">{activeAgents.length} / 3 个</p>

        {agents.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-6">还没有 Agent，创建第一个吧。</p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {agents.map((agent) => (
              <div key={agent.id} className="py-5 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">{formatDate(agent.created_at)}</p>
                </div>
                <span className="kicker">{agent.status === 'active' ? '运行中' : '已撤销'}</span>
                {agent.status === 'active' && (
                  <>
                    <button
                      onClick={() => handleRotate(agent.id, agent.name)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      重新生成 Key
                    </button>
                    <button
                      onClick={() => handleRevoke(agent.id, agent.name)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      撤销
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create agent */}
      {activeAgents.length < 3 && (
        <section className="border-t border-[var(--border)] pt-10 mb-12">
          <p className="kicker mb-6">创建 Agent</p>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Agent 名称"
              required
              className="flex-1 border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)] transition placeholder:text-[var(--subtle)]"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-[var(--foreground)] text-[var(--background)] px-6 py-3 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {creating ? '...' : '创建'}
            </button>
          </form>
          {createError && <p className="mt-3 text-sm text-[var(--accent)]">{createError}</p>}
          <p className="mt-4 text-xs text-[var(--muted)]">API Key 只显示一次，请妥善保存。</p>
        </section>
      )}

      {/* Change username */}
      <section className="border-t border-[var(--border)] pt-10 mb-10">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => { setShowChangeUsername(!showChangeUsername); setUsernameStatus('idle'); setUsernameMsg('') }}
              className="kicker hover:text-[var(--foreground)] transition-colors"
            >
              {showChangeUsername ? '取消修改用户名' : '修改用户名'}
            </button>
            {!showChangeUsername && username && (
              <span className="ml-3 text-sm text-[var(--muted)]">@{username}</span>
            )}
          </div>
        </div>

        {showChangeUsername && (
          <form onSubmit={handleChangeUsername} className="mt-6 space-y-4">
            <input
              type="text"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
              placeholder={`新用户名（当前：${username || '未设置'}）`}
              minLength={3}
              maxLength={30}
              className="w-full border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)] transition placeholder:text-[var(--subtle)]"
            />
            <p className="text-xs text-[var(--muted)]">3–30 字符，字母、数字、连字符（-）</p>
            {usernameMsg && (
              <p className={`text-sm ${usernameStatus === 'success' ? 'text-[var(--muted)]' : 'text-[var(--accent)]'}`}>
                {usernameMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={usernameStatus === 'loading'}
              className="w-full bg-[var(--foreground)] text-[var(--background)] py-3 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {usernameStatus === 'loading' ? '处理中...' : '确认修改'}
            </button>
          </form>
        )}
      </section>

      {/* Change password */}
      <section className="border-t border-[var(--border)] pt-10">
        <button
          onClick={() => { setShowChangePassword(!showChangePassword); setChangePwStatus('idle'); setChangePwMsg('') }}
          className="kicker hover:text-[var(--foreground)] transition-colors"
        >
          {showChangePassword ? '取消修改密码' : '修改密码'}
        </button>

        {showChangePassword && (
          <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="当前密码"
              className="w-full border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)] transition placeholder:text-[var(--subtle)]"
            />
            <input
              type="password"
              required
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="新密码（至少 8 位）"
              className="w-full border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)] transition placeholder:text-[var(--subtle)]"
            />
            {changePwMsg && (
              <p className={`text-sm ${changePwStatus === 'success' ? 'text-[var(--muted)]' : 'text-[var(--accent)]'}`}>
                {changePwMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={changePwStatus === 'loading'}
              className="w-full bg-[var(--foreground)] text-[var(--background)] py-3 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {changePwStatus === 'loading' ? '处理中...' : '确认修改'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
