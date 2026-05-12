import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { IntelCalendar, type IntelDay } from './IntelCalendar'
import { SignalFeed } from './SignalFeed'
import { SignalHighlights } from './SignalHighlights'
import type { Signal } from '@/types'
import { getTodayYmd } from '@/lib/timezone'

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
  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd = new Date(year, month, 1).toISOString()

  const supabase = await createClient()
  const [{ data: signalData }, { data: monthSignals }] = await Promise.all([
    supabase
      .from('ai_pulse_signals')
      .select('id, url, source_type, source_name, title, description, signal_date, status, metadata, reason, insight, actionable, influence, created_at, updated_at')
      .eq('status', 'enabled')
      .eq('signal_date', targetDate)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_pulse_signals')
      .select('signal_date, title, source_name, url, created_at')
      .eq('status', 'enabled')
      .gte('signal_date', monthStart.slice(0, 10))
      .lt('signal_date', monthEnd.slice(0, 10))
      .order('created_at', { ascending: false }),
  ])

  const dayMap = new Map<string, IntelDay>()
  for (const row of monthSignals ?? []) {
    const date = row.signal_date
    if (!date) continue

    const existing = dayMap.get(date)
    if (!existing) {
      dayMap.set(date, {
        date,
        overview: '',
        keywords: [],
        image_url: null,
        signal_previews: [{
          title: row.title ?? 'Untitled',
          source_name: row.source_name ?? null,
          url: row.url ?? null,
        }],
      })
      continue
    }

    const previews = existing.signal_previews ?? []
    if (previews.length < 3) {
      previews.push({
        title: row.title ?? 'Untitled',
        source_name: row.source_name ?? null,
        url: row.url ?? null,
      })
      existing.signal_previews = previews
    }
  }

  const days = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date))

  const signals = (signalData ?? []) as Signal[]

  return (
    <div>
      <div className="mb-8">
        <p className="kicker mb-2" style={{ color: 'var(--accent)' }}>Intel</p>
        <h1 className="font-serif text-3xl font-medium tracking-tight">情报</h1>
        <p className="mt-4 text-base md:text-lg text-[var(--muted)] leading-relaxed">
          每日 AI 信号精选 —— 追踪真正值得关注的变化，来自 HN、GitHub 与 arXiv。
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
