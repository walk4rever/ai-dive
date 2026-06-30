import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '@/lib/supabase/env'
import {
  buildSignalCalendarDays,
  type SignalCalendarDay,
  type SignalCalendarRow,
} from '@/lib/signals-calendar'

const PAGE_SIZE = 1000

async function fetchSignalCalendarRows(monthStart: string, monthEnd: string): Promise<SignalCalendarRow[]> {
  const { url, serviceRoleKey, hasServiceRoleEnv } = getSupabaseEnv()

  if (!hasServiceRoleEnv || !url || !serviceRoleKey) {
    throw new Error(
      'Supabase service env is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
  const rows: SignalCalendarRow[] = []

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
      console.error('[signals-calendar-cache] fetch failed', {
        monthStart,
        monthEnd,
        from,
        to,
        message: error.message,
      })
      break
    }

    rows.push(...((data ?? []) as SignalCalendarRow[]))
    if ((data ?? []).length < PAGE_SIZE) break
  }

  return rows
}

export const fetchCachedSignalCalendarDays = unstable_cache(
  async (monthStart: string, monthEnd: string): Promise<SignalCalendarDay[]> => {
    const rows = await fetchSignalCalendarRows(monthStart, monthEnd)
    return buildSignalCalendarDays(rows)
  },
  ['signal-calendar-days'],
  {
    revalidate: 300,
    tags: ['signal-calendar-days'],
  }
)
