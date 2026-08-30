'use client'

import { useState } from 'react'

interface DeckBuyButtonProps {
  slug: string
  priceLabel: string
}

/** Starts an Alipay checkout for one deck: asks the API for a pay URL keyed to a
 *  fresh pending order, then hands the browser to Alipay's cashier. Nothing is
 *  unlocked here — entitlement only ever comes from the payment callback. */
export function DeckBuyButton({ slug, priceLabel }: DeckBuyButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout() {
    setPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/decks/${slug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'alipay' }),
      })

      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent('/decks')}`
        return
      }

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.payUrl) {
        setError(data?.error ?? '下单失败，请稍后再试')
        setPending(false)
        return
      }

      // Leaving the page on purpose — `pending` stays true so the button can't be
      // clicked twice while the browser navigates away.
      window.location.href = data.payUrl
    } catch {
      setError('网络异常，请稍后再试')
      setPending(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={startCheckout}
        disabled={pending}
        className="rounded-md border border-[var(--accent)] px-4 py-2 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? '正在跳转支付宝…' : `${priceLabel} 支付宝购买`}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>}
    </div>
  )
}
