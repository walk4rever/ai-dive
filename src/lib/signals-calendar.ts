import type { SupabaseClient } from '@supabase/supabase-js'

export interface SignalCalendarDay {
  date: string
  overview: string
  keywords: string[]
  image_url?: string | null
  signal_previews?: Array<{
    title: string
    source_name?: string | null
    url?: string | null
  }>
}

export interface SignalCalendarRow {
  signal_date: string | null
  title: string | null
  source_name: string | null
  url: string | null
  created_at: string
}

const PAGE_SIZE = 1000

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function getMonthDateRange(year: number, month: number) {
  const monthStart = `${year}-${pad2(month)}-01`
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  const monthEnd = `${nextMonth.year}-${pad2(nextMonth.month)}-01`
  return { monthStart, monthEnd }
}

export function buildSignalCalendarDays(rows: SignalCalendarRow[]): SignalCalendarDay[] {
  const dayMap = new Map<string, SignalCalendarDay>()

  for (const row of rows) {
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
          source_name: row.source_name,
          url: row.url,
        }],
      })
      continue
    }

    const previews = existing.signal_previews ?? []
    if (previews.length < 3) {
      previews.push({
        title: row.title ?? 'Untitled',
        source_name: row.source_name,
        url: row.url,
      })
      existing.signal_previews = previews
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export async function fetchSignalCalendarDays(
  supabase: SupabaseClient,
  monthStart: string,
  monthEnd: string
): Promise<SignalCalendarDay[]> {
  const allRows: SignalCalendarRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('ai_pulse_signals')
      .select('signal_date, title, source_name, url, created_at')
      .eq('status', 'enabled')
      .gte('signal_date', monthStart)
      .lt('signal_date', monthEnd)
      .order('signal_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('[signals-calendar] fetch failed', {
        monthStart,
        monthEnd,
        from,
        to,
        message: error.message,
      })
      break
    }

    const rows = (data ?? []) as SignalCalendarRow[]
    allRows.push(...rows)

    if (rows.length < PAGE_SIZE) break
  }

  return buildSignalCalendarDays(allRows)
}
