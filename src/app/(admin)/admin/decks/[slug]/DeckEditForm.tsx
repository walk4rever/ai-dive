'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Deck {
  slug: string
  title: string
  kicker: string
  description: string
  meta: string
  date: string
  status: string
  price_cents: number | null
  currency: string
}

const KICKERS = ['KEYNOTE', 'COURSE', 'REPORT', 'PLAYBOOK'] as const

export function DeckEditForm({ deck }: { deck: Deck }) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: deck.title,
    kicker: deck.kicker,
    description: deck.description,
    meta: deck.meta,
    date: deck.date,
    status: deck.status,
    // Yuan, as a string for the input — blank means "never priced / free", matching
    // how price_cents === null renders here. The API (parsePriceYuanToCents) is the
    // single place that converts this back to cents, so blank and an explicit "0"
    // are handled identically there too.
    price: deck.price_cents === null ? '' : (deck.price_cents / 100).toFixed(2),
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch(`/api/admin/decks/${deck.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        kicker: form.kicker,
        description: form.description,
        meta: form.meta,
        date: form.date,
        status: form.status,
        price: form.price,
      }),
    })

    if (res.ok) {
      setSaved(true)
      router.refresh()
    } else {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? '保存失败')
    }
    setSaving(false)
  }

  const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition'
  const labelClass = 'kicker mb-2 block'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className={labelClass}>标题</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>类型</label>
          <select value={form.kicker} onChange={(e) => update('kicker', e.target.value)} className={inputClass}>
            {KICKERS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>发布日期</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>描述</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>元信息（如「43 slides · 60 min」）</label>
        <input
          type="text"
          value={form.meta}
          onChange={(e) => update('meta', e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>价格（元，{deck.currency}）</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={(e) => update('price', e.target.value)}
          placeholder="留空 = 免费"
          className={inputClass}
        />
        <p className="mt-2 text-xs text-[var(--muted)]">留空或填 0 都表示不设价格、免费开放，不会存成&ldquo;¥0&rdquo;这样一个需要走支付的价格。</p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.status === 'published'}
          onChange={(e) => update('status', e.target.checked ? 'published' : 'draft')}
        />
        <span className="kicker">已发布</span>
      </label>

      {error && <p className="text-sm text-[var(--accent)]">{error}</p>}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[var(--radius-md)] bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/decks')}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-6 py-2.5 text-sm text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)] hover:text-[var(--accent)]"
        >
          取消
        </button>
        {saved && <span className="text-sm text-[var(--muted)]">已保存</span>}
      </div>
    </form>
  )
}
