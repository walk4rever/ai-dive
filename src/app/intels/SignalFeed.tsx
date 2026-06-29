'use client'

import type { Signal } from '@/types'

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  x:           { label: 'X',           className: 'bg-black text-white' },
  github:      { label: 'GitHub',      className: 'bg-[#333] text-white' },
  arxiv:       { label: 'arXiv',       className: 'bg-[#b31b1b] text-white' },
  a16z:        { label: 'a16z',        className: 'bg-[#1a1a2e] text-white' },
  techcrunch:  { label: 'TC',          className: 'bg-[#0d9a0d] text-white' },
  ithome:      { label: 'IT之家',      className: 'bg-[#c00] text-white' },
  yc:          { label: 'YC',          className: 'bg-[#ff6600] text-white' },
  web:         { label: 'Web',         className: 'bg-[var(--subtle)] text-[var(--foreground)]' },
}

function SourceBadge({ type }: { type: string }) {
  const badge = SOURCE_BADGE[type] ?? SOURCE_BADGE.web
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium leading-none ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function SignalCard({ signal }: { signal: Signal }) {
  const ogImage = signal.metadata?.og_image
  const category = signal.metadata?.category as string | null | undefined

  return (
    <a
      href={signal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block py-4 border-b border-[var(--border-subtle)] hover:bg-[color-mix(in_oklch,var(--background)_97%,var(--accent)_3%)] transition-colors -mx-4 px-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <SourceBadge type={signal.source_type} />
        {signal.source_name && (
          <span className="text-xs text-[var(--muted)] truncate">{signal.source_name}</span>
        )}
        {category && (
          <span className="ml-auto text-[10px] text-[var(--muted)] shrink-0">{category}</span>
        )}
      </div>
      <p className="text-sm font-medium leading-snug group-hover:text-[var(--accent)] transition-colors">
        {signal.title}
      </p>
      {signal.description && (
        <p className="mt-1.5 text-xs text-[var(--muted)] leading-relaxed">
          {signal.description}
        </p>
      )}
      {ogImage && (
        <div className="mt-3 aspect-[1.91/1] w-64 overflow-hidden bg-[var(--subtle)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ogImage}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
    </a>
  )
}

interface Props {
  signals: Signal[]
}

export function SignalFeed({ signals }: Props) {
  if (signals.length === 0) {
    return <p className="text-sm text-[var(--muted)] py-4">本月暂无信号数据。</p>
  }

  return (
    <div>
      {signals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  )
}
