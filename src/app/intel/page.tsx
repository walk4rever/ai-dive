import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { IntelCalendar } from './IntelCalendar'
import { SignalFeed } from './SignalFeed'
import { SignalHighlights } from './SignalHighlights'
import type { Signal } from '@/types'
import { getTodayYmd } from '@/lib/timezone'
import { fetchSignalCalendarDays, getMonthDateRange } from '@/lib/signals-calendar'

export const revalidate = 300

export const metadata = {
  title: '情报 | AI-DIVE',
}

function parseYearMonth(value?: string): { year: number; month: number } | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function parseDate(value?: string): { year: number; month: number } | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function parseYearMonthFromYmd(value: string): { year: number; month: number } {
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) }
}

export default async function IntelPage({ searchParams }: { searchParams: Promise<{ d?: string; m?: string }> }) {
  const { d, m } = await searchParams
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) {
    return <p className="text-sm text-[var(--muted)]">配置未完成。</p>
  }

  const today = getTodayYmd()
  const todayYearMonth = parseYearMonthFromYmd(today)
  const byDate = parseDate(d)
  const byMonth = parseYearMonth(m)
  const target = byDate ?? byMonth ?? todayYearMonth
  const targetDate = d ?? today
  const year = target.year
  const month = target.month
  const { monthStart, monthEnd } = getMonthDateRange(year, month)

  const supabase = await createClient()
  const [{ data: signalData }, days] = await Promise.all([
    supabase
      .from('ai_pulse_signals')
      .select('id, url, source_type, source_name, title, description, signal_date, status, metadata, reason, insight, actionable, influence, created_at, updated_at')
      .eq('status', 'enabled')
      .eq('signal_date', targetDate)
      .order('created_at', { ascending: false }),
    fetchSignalCalendarDays(supabase, monthStart, monthEnd),
  ])

  const signals = (signalData ?? []) as Signal[]

  return (
    <div>
      <div className="mb-8">
        <p className="kicker mb-2" style={{ color: 'var(--accent)' }}>Intel</p>
        <h1 className="font-serif text-3xl font-medium tracking-tight">情报</h1>
        <p className="mt-4 text-base md:text-lg text-[var(--muted)] leading-relaxed">
          过滤海量技术噪点，追踪源头的微小震动；从深度洞察、落地实践与行业影响三重维度，还原每一个 AI 信号的真实价值。
        </p>
      </div>
      <section className="mb-10 flex flex-col sm:flex-row sm:items-center items-start gap-6">
        <IntelCalendar key={`${year}-${month}`} year={year} month={month} days={days} initialDate={d} />
        <div className="flex-1 min-w-0">
          <p className="kicker mb-3">{targetDate} 精选</p>
          <SignalHighlights signals={signals} />
        </div>
      </section>
      <section className="mt-16 border-t border-[var(--border)] pt-10">
        <p className="kicker mb-6">{targetDate} 信号</p>
        <SignalFeed signals={signals} />
      </section>
    </div>
  )
}
