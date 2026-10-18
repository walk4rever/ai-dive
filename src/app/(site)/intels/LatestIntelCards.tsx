import Link from 'next/link'
import type { Signal } from '@/types'
import { signalIntelHref } from '@/lib/intel-links'
import { SourceBadge } from './SourceBadge'

function LatestIntelCard({ signal }: { signal: Signal }) {
  const category = signal.metadata?.category as string | null | undefined

  return (
    <Link
      href={signalIntelHref(signal)}
      className="group flex flex-col border border-[var(--border-subtle)] bg-[var(--background)] p-4 hover:border-[var(--foreground)] transition-colors"
    >
      <div className="flex items-center gap-2">
        <SourceBadge type={signal.source_type} />
        <span className="date">{signal.signal_date.replaceAll('-', '.')}</span>
        {category && (
          <span className="ml-auto truncate text-[10px] text-[var(--muted)]">{category}</span>
        )}
      </div>
      <h3 className="mt-3 font-serif text-base font-medium leading-snug text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
        {signal.title}
      </h3>
      {signal.description && (
        <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-[var(--muted)]">
          {signal.description}
        </p>
      )}
      {signal.source_name && (
        <p className="mt-4 truncate text-[10px] text-[var(--subtle)]">
          {signal.source_name}
        </p>
      )}
    </Link>
  )
}

export function LatestIntelCards({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return <p className="py-6 text-sm text-[var(--muted)]">暂无情报。</p>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {signals.map((signal) => (
        <LatestIntelCard key={signal.id} signal={signal} />
      ))}
    </div>
  )
}
