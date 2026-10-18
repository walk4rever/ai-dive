import type { Signal } from '@/types'
import { signalAnchorId } from '@/lib/intel-links'
import { SourceBadge } from './SourceBadge'

function SignalCard({ signal }: { signal: Signal }) {
  const category = signal.metadata?.category as string | null | undefined

  return (
    <article
      id={signalAnchorId(signal.id)}
      className="signal-entry scroll-mt-8 py-7 border-b border-[var(--border-subtle)] -mx-4 px-4"
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
      <h2 className="signal-entry-title text-base md:text-lg font-medium leading-snug text-[var(--foreground)]">
        {signal.title}
      </h2>
      {signal.description && (
        <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
          {signal.description}
        </p>
      )}
      <div className="mt-4">
        <a
          href={signal.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`阅读原文：${signal.title}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          阅读原文
          <span aria-hidden>↗</span>
        </a>
      </div>
    </article>
  )
}

interface Props {
  signals: Signal[]
}

export function SignalFeed({ signals }: Props) {
  if (signals.length === 0) {
    return <p className="text-sm text-[var(--muted)] py-6">这一天还没有情报。</p>
  }

  return (
    <div>
      {signals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  )
}
