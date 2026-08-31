import { Card } from '@/components/ui/Card'

interface QuotaCardProps {
  credits: number
  total: number
  /** 'YYYY-MM' from src/lib/credits — the exact window the balance is counted over,
   *  so the label can never drift from what was actually summed. */
  period: string
}

export function QuotaCard({ credits, total, period }: QuotaCardProps) {
  const remaining = Math.max(0, Math.min(credits, total))
  const percent = total > 0 ? Math.round((remaining / total) * 100) : 0
  const exhausted = remaining === 0
  const [year, month] = period.split('-')

  return (
    <Card kicker="本月 AI 额度" aside={<span className="date">{year}.{month}</span>}>
      <p className="mt-6 flex items-baseline gap-2">
        <span className="font-serif text-4xl font-medium tabular-nums leading-none">{remaining}</span>
        <span className="text-sm text-[var(--muted)]">/ {total} 次</span>
      </p>

      <div
        role="progressbar"
        aria-label="本月剩余 AI 额度"
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={total}
        className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className={`mt-4 text-xs leading-relaxed ${exhausted ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
        {exhausted
          ? '本月额度已用完，下月 1 日自动刷新。'
          : '每月 1 日自动刷新，用于「探索」与文章 AI解读，一轮对话记 1 次。'}
      </p>
    </Card>
  )
}
