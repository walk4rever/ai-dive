'use client'

import { useState } from 'react'
import { FREE_MONTHLY_CREDITS } from '@/lib/credits'
import type { AdminUser } from '@/lib/admin/users'
import { Card } from '@/components/ui/Card'
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog'

function formatDate(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/** Filled when the user is already admin (the icon represents "revoke"), outline
 *  when they're not (represents "grant") — same shield shape either way so the
 *  action reads as one toggle, not two different capabilities. */
function ShieldIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5L13.5 3.5V7.5C13.5 10.8 11.2 13.4 8 14.5C4.8 13.4 2.5 10.8 2.5 7.5V3.5L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 4.5H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.5 4.5L5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 7V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9.5 7V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

interface UsersManagerProps {
  initialUsers: AdminUser[]
  /** The signed-in admin's own id — the role-toggle and delete actions are hidden
   *  for this row so nobody can demote or delete themselves from the UI (the API
   *  rejects both too; this just avoids showing an action that would only ever fail). */
  currentUserId: string
}

export function UsersManager({ initialUsers, currentUserId }: UsersManagerProps) {
  const [users, setUsers] = useState(initialUsers)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  async function toggleRole(user: AdminUser) {
    const nextRole = user.role === 'admin' ? 'user' : 'admin'
    const verb = nextRole === 'admin' ? '设为管理员' : '取消管理员权限'
    if (!confirm(`确认把「${user.username || user.email}」${verb}？`)) return

    setBusyId(user.id)
    setActionError('')
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setActionError(data?.error ?? '操作失败，请重试')
      setBusyId(null)
      return
    }

    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)))
    setBusyId(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    setActionError('')
    const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setActionError(data?.error ?? '删除失败，请重试')
      setBusyId(null)
      setDeleteTarget(null)
      return
    }

    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
    setBusyId(null)
    setDeleteTarget(null)
  }

  return (
    <Card>
      <div className="mb-4">
        <p className="kicker">Accounts</p>
        <p className="font-serif text-2xl font-medium tracking-tight mt-1">用户管理</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          角色修改在对方下次登录时才会生效（角色写在登录时签发的会话里，不会实时踢下线重新签发）。删除用户会连带永久删除其 Agent、订单、AI 额度流水和会话记录。
        </p>
      </div>

      {actionError && <p className="mb-3 text-sm text-[var(--accent)]">{actionError}</p>}

      <div className="hidden md:grid md:grid-cols-[1fr_110px_80px_90px_90px_90px_80px] md:gap-3 px-2 pb-2 border-b border-[var(--border)] text-xs text-[var(--muted)]">
        <span>邮箱 / 用户名</span>
        <span>注册时间</span>
        <span>邮箱验证</span>
        <span>本月额度</span>
        <span>出品订单</span>
        <span>角色</span>
        <span className="text-right">操作</span>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          const busy = busyId === user.id
          return (
            <div key={user.id} className="py-3 md:grid md:grid-cols-[1fr_110px_80px_90px_90px_90px_80px] md:items-center gap-3 px-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{user.email}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{user.username ? `@${user.username}` : '未设置用户名'}</p>
              </div>
              <p className="date mt-2 md:mt-0">{formatDate(user.created_at)}</p>
              <p className="kicker mt-2 md:mt-0">{user.email_verified_at ? '已验证' : '未验证'}</p>
              <p className="text-sm mt-2 md:mt-0">{user.creditsBalance} / {FREE_MONTHLY_CREDITS}</p>
              <p className="text-sm mt-2 md:mt-0">{user.deckOrderCount}</p>
              <p className="mt-2 md:mt-0">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] leading-5 ${
                  user.role === 'admin' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'
                }`}>
                  {user.role === 'admin' ? '管理员' : '用户'}
                </span>
              </p>
              <div className="mt-3 md:mt-0 flex items-center gap-3 md:justify-end">
                {isSelf ? (
                  <span className="kicker text-[var(--subtle)]">当前账号</span>
                ) : (
                  <>
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={busy}
                      title={user.role === 'admin' ? '取消管理员' : '设为管理员'}
                      aria-label={user.role === 'admin' ? '取消管理员' : '设为管理员'}
                      className={`flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] transition-colors disabled:opacity-40 ${
                        user.role === 'admin' ? 'text-[var(--accent)] hover:bg-[var(--border-subtle)]' : 'text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--border-subtle)]'
                      }`}
                    >
                      <ShieldIcon filled={user.role === 'admin'} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(user)}
                      disabled={busy}
                      title="删除用户"
                      aria-label="删除用户"
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {deleteTarget && (
        <ConfirmDeleteDialog
          title="删除用户"
          description={`此操作不可撤销，将永久删除「${deleteTarget.username || deleteTarget.email}」及其 Agent、订单、AI 额度流水和会话记录。`}
          confirmValue={deleteTarget.email}
          busy={busyId === deleteTarget.id}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Card>
  )
}
