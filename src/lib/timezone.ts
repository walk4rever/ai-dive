const DEFAULT_APP_TIME_ZONE = 'Asia/Shanghai'

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE ?? DEFAULT_APP_TIME_ZONE

export function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null

  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const t = new Date(Date.UTC(y, mo - 1, d))
  if (
    t.getUTCFullYear() !== y ||
    t.getUTCMonth() + 1 !== mo ||
    t.getUTCDate() !== d
  )
    return null

  return { y, m: mo, d }
}

export function formatYmdInTimeZone(date: Date, timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function getTodayYmd(timeZone = APP_TIME_ZONE): string {
  return formatYmdInTimeZone(new Date(), timeZone)
}

export function addDaysYmd(ymd: string, days: number): string {
  const parsed = parseYmd(ymd)
  if (!parsed) return ymd
  const utc = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}
