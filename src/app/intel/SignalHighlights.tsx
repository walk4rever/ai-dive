'use client'

import type { Signal } from '@/types'

const DIMENSIONS = [
  { key: 'insight', label: '洞见' },
  { key: 'actionable', label: '实践' },
  { key: 'influence', label: '影响力' },
] as const

const FALLBACK_PRIORITY = {
  insight: ['paper', 'ai-models', 'industry', 'ai-products', 'tip'],
  actionable: ['tip', 'ai-products', 'paper', 'ai-models', 'industry'],
  influence: ['industry', 'ai-products', 'ai-models', 'paper', 'tip'],
} as const

function pickByDimension(signals: Signal[], key: 'insight' | 'actionable' | 'influence', exclude: Set<string>): Signal | null {
  const pool = signals.filter((s) => !exclude.has(s.id))
  const sorted = [...pool]
    .filter((s) => typeof s[key] === 'number')
    .sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1))
  if (sorted[0]) return sorted[0]

  for (const cat of FALLBACK_PRIORITY[key]) {
    const found = pool.find((s) => (s.metadata?.category as string | null) === cat)
    if (found) return found
  }
  return pool[0] ?? null
}

function HighlightCard({ label, signal }: { label: string; signal: Signal }) {
  return (
    <a
      href={signal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-2 border border-[var(--border-subtle)] p-4 bg-[var(--background)] hover:border-[var(--foreground)] transition-colors"
    >
      <p className="kicker" style={{ color: 'var(--accent)' }}>{label}</p>
      <p className="text-sm font-medium leading-snug group-hover:text-[var(--accent)] transition-colors">
        {signal.title}
      </p>
      {signal.description && (
        <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-3 flex-1">
          {signal.description}
        </p>
      )}
      {signal.source_name && (
        <p className="text-[10px] text-[var(--muted)] mt-auto">{signal.source_name}</p>
      )}
    </a>
  )
}

interface Props {
  signals: Signal[]
}

export function SignalHighlights({ signals }: Props) {
  if (signals.length === 0) return null

  const exclude = new Set<string>()
  const cards = DIMENSIONS.map(({ key, label }) => {
    const signal = pickByDimension(signals, key, exclude)
    if (signal) exclude.add(signal.id)
    return signal ? { key, label, signal } : null
  }).filter(Boolean) as { key: string; label: string; signal: Signal }[]

  if (cards.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
      {cards.map(({ key, label, signal }) => (
        <HighlightCard key={key} label={label} signal={signal} />
      ))}
    </div>
  )
}
