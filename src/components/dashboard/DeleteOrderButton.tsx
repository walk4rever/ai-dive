'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserOrder } from '@/lib/orders/list'

interface DeleteOrderButtonProps {
  orderId: string
  status: UserOrder['status']
}

const CONFIRM_COPY: Partial<Record<UserOrder['status'], string>> = {
  paid: '记录将从列表移除，已购内容仍可阅读',
  pending: '这笔待支付订单将被取消',
}

export function DeleteOrderButton({ orderId, status }: DeleteOrderButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
      if (res.status === 401) {
        window.location.href = '/login?next=%2Fdashboard'
        return
      }
      if (!res.ok) {
        setError('删除失败，请重试')
        setBusy(false)
        return
      }

      setConfirming(false)
      setBusy(false)
      router.refresh()
    } catch {
      setError('网络异常，请重试')
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null)
          setConfirming(true)
        }}
        className="shrink-0 text-xs text-[var(--subtle)] transition-colors hover:text-red-600"
      >
        删除
      </button>
    )
  }

  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs">
      <span className="text-[var(--subtle)]">
        {CONFIRM_COPY[status] ?? '删除后不再显示'}
      </span>
      {error && <span className="text-red-600">{error}</span>}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-red-600 transition-opacity hover:opacity-70 disabled:opacity-40"
      >
        {busy ? '删除中…' : '确认'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40"
      >
        取消
      </button>
    </span>
  )
}
