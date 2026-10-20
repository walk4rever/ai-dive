import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { getTodayYmd, parseYmd } from '@/lib/timezone'
import { getMonthDateRange } from '@/lib/signals-calendar'
import { fetchCachedSignalCalendarDays } from '@/lib/signals-calendar-server'
import { intelDatePath } from '@/lib/intel-links'
import type { Signal } from '@/types'
import { AiChatPanel } from '@/components/AiChatPanel'
import { SignalFeed } from '../SignalFeed'
import { SignalTargetEffect } from '../SignalTargetEffect'
import { IntelDatePicker } from '../IntelDatePicker'

export const revalidate = 300

interface Props {
  params: Promise<{ date: string }>
  searchParams: Promise<{ m?: string }>
}

function parseYearMonth(value?: string): { year: number; month: number } | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function dateLabel(date: string) {
  const parsed = parseYmd(date)
  if (!parsed) return date
  return `${parsed.y} 年 ${parsed.m} 月 ${parsed.d} 日`
}

function weekdayLabel(date: string) {
  const parsed = parseYmd(date)
  if (!parsed) return ''
  const weekday = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay()
  return `星期${'日一二三四五六'[weekday]}`
}

function shortDateLabel(date: string) {
  const parsed = parseYmd(date)
  if (!parsed) return date
  return `${parsed.m} 月 ${parsed.d} 日`
}

const INTEL_SUGGESTIONS = [
  '今天最重要的三条信号是什么？',
  '按主题给今天的情报归类',
  '哪些信号可以合成一个深度选题？',
  '这些情报之间有什么关联？',
]

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { date } = await params
  const parsed = parseYmd(date)
  if (!parsed) return { title: '情报 | AI-DIVE' }

  const label = `${parsed.m} 月 ${parsed.d} 日情报`
  const description = `${dateLabel(date)}的 AI 技术情报精选：当天值得关注的模型、产品、开源项目和研究信号。`

  return {
    title: `${label} | AI-DIVE`,
    description,
    alternates: { canonical: intelDatePath(date) },
    openGraph: {
      title: label,
      description,
      url: intelDatePath(date),
      siteName: 'AI-DIVE',
      type: 'article',
    },
  }
}

export default async function IntelDatePage({ params, searchParams }: Props) {
  const { date } = await params
  const { m } = await searchParams
  const parsedDate = parseYmd(date)
  if (!parsedDate) notFound()

  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) {
    return <p className="text-sm text-[var(--muted)]">配置未完成。</p>
  }

  const calendarMonth = parseYearMonth(m) ?? { year: parsedDate.y, month: parsedDate.m }
  const { year, month } = calendarMonth
  const { monthStart, monthEnd } = getMonthDateRange(year, month)
  const supabase = await createClient()

  const [
    { data: signalData },
    days,
    { data: previousRows },
    { data: nextRows },
  ] = await Promise.all([
    supabase
      .from('ai_pulse_signals')
      .select('id, url, source_type, source_name, title, description, signal_date, status, metadata, created_at, updated_at')
      .eq('status', 'enabled')
      .eq('signal_date', date)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    fetchCachedSignalCalendarDays(monthStart, monthEnd),
    supabase
      .from('ai_pulse_signals')
      .select('signal_date')
      .eq('status', 'enabled')
      .lt('signal_date', date)
      .order('signal_date', { ascending: false })
      .limit(1),
    supabase
      .from('ai_pulse_signals')
      .select('signal_date')
      .eq('status', 'enabled')
      .gt('signal_date', date)
      .order('signal_date', { ascending: true })
      .limit(1),
  ])

  const signals = (signalData ?? []) as Signal[]
  const previousDate = (previousRows?.[0] as { signal_date?: string } | undefined)?.signal_date ?? null
  const nextDate = (nextRows?.[0] as { signal_date?: string } | undefined)?.signal_date ?? null
  const sourceCount = new Set(
    signals.map((signal) => signal.source_name || signal.source_type || 'unknown')
  ).size
  const today = getTodayYmd()

  return (
    <AiChatPanel
      pageContext={{ kind: 'intel_day', id: date }}
      title={`${parsedDate.m} 月 ${parsedDate.d} 日情报`}
      suggestions={INTEL_SUGGESTIONS}
      inputPlaceholder="针对当天情报提问…（Enter 发送，Shift+Enter 换行）"
      emptyHint="可以直接询问当天信号的重点、关联和选题价值。"
      shareUrl={intelDatePath(date)}
      shareTitle={`${parsedDate.y} 年 ${parsedDate.m} 月 ${parsedDate.d} 日情报`}
      contentWidthClass="max-w-none"
    >
      <div>
        <SignalTargetEffect />
        <header className="mb-10">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="kicker" style={{ color: 'var(--accent)' }}>Intel Daily</p>
            <h1 className="mt-3 font-serif text-3xl md:text-5xl font-medium tracking-tight">
              {parsedDate.m} 月 {parsedDate.d} 日情报
            </h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {dateLabel(date)} · {weekdayLabel(date)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {date !== today && (
              <Link
                href={intelDatePath(today)}
                className="hidden sm:inline text-xs font-medium text-[var(--accent)] hover:underline"
              >
                回到今天
              </Link>
            )}
            <IntelDatePicker
              year={year}
              month={month}
              days={days}
              date={date}
            />
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-base md:text-lg text-[var(--muted)] leading-relaxed">
          当天值得关注的 AI 信号集中在这里。先读摘要，需要更多细节时再前往原始来源。
        </p>
        <p className="mt-4 text-xs text-[var(--subtle)]">
          {signals.length} 条情报 · {sourceCount} 个来源
        </p>
        </header>

        <section className="border-t border-[var(--border)] pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="kicker">当日情报</p>
            <span className="date">{signals.length} 条</span>
          </div>
          <SignalFeed signals={signals} />
        </section>

        <nav aria-label="情报日期导航" className="mt-12 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-6">
        {previousDate ? (
          <Link
            href={intelDatePath(previousDate)}
            className="group flex flex-col gap-1 rounded-xl border border-[var(--border-subtle)] px-4 py-3 transition-colors hover:border-[var(--foreground)]"
          >
            <span className="kicker">← 前一天</span>
            <span className="text-sm font-medium group-hover:text-[var(--accent)] transition-colors">
              {shortDateLabel(previousDate)}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {nextDate ? (
          <Link
            href={intelDatePath(nextDate)}
            className="group flex flex-col items-end gap-1 rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-right transition-colors hover:border-[var(--foreground)]"
          >
            <span className="kicker">后一天 →</span>
            <span className="text-sm font-medium group-hover:text-[var(--accent)] transition-colors">
              {shortDateLabel(nextDate)}
            </span>
          </Link>
        ) : (
          <span />
        )}
        </nav>
      </div>
    </AiChatPanel>
  )
}
