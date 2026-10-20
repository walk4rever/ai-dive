'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { intelDatePath } from '@/lib/intel-links'

export interface IntelDay {
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

interface Props {
  year: number
  month: number
  days: IntelDay[]
  initialDate?: string
  monthParam?: 'im' | 'm'
  onDateNavigate?: () => void
  className?: string
}

const DOW = ['一', '二', '三', '四', '五', '六', '日']

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function startOffset(year: number, month: number) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function IntelCalendar({
  year,
  month,
  days,
  initialDate,
  monthParam = 'm',
  onDateNavigate,
  className = '',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days])
  const [selected, setSelected] = useState<string | null>(
    initialDate && byDate.has(initialDate) ? initialDate : null
  )

  const total = daysInMonth(year, month)
  const offset = startOffset(year, month)
  const monthLabel = `${year} 年 ${month} 月`
  const prev = shiftMonth(year, month, -1)
  const next = shiftMonth(year, month, 1)

  function goToMonth(targetYear: number, targetMonth: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(monthParam, `${targetYear}-${pad(targetMonth)}`)
    params.delete('d')
    params.delete(monthParam === 'im' ? 'm' : 'im')
    router.push(`${pathname}?${params.toString()}`)
  }

  function goToDate(dateStr: string) {
    setSelected(dateStr)
    onDateNavigate?.()
    router.push(intelDatePath(dateStr))
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          onClick={() => goToMonth(prev.year, prev.month)}
          className="text-[0.8rem] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
          aria-label="上个月"
        >
          ‹
        </button>
        <span className="font-serif text-sm font-semibold">{monthLabel}</span>
        <button
          type="button"
          onClick={() => goToMonth(next.year, next.month)}
          className="text-[0.8rem] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
          aria-label="下个月"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {DOW.map((day) => (
          <div key={day} className="text-center text-[0.6rem] font-medium tracking-widest uppercase text-[var(--muted)] py-1">
            {day}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, index) => (
          <div key={`empty-${index}`} />
        ))}
        {Array.from({ length: total }).map((_, index) => {
          const day = index + 1
          const dateStr = `${year}-${pad(month)}-${pad(day)}`
          const hasSignals = byDate.has(dateStr)
          const isSelected = selected === dateStr
          return (
            <button
              key={day}
              type="button"
              onClick={() => hasSignals && goToDate(dateStr)}
              className={[
                'flex flex-col items-center justify-center gap-0.5 rounded-md h-7 text-[0.72rem] transition-colors',
                isSelected
                  ? 'bg-[var(--accent)] text-white'
                  : hasSignals
                    ? 'hover:bg-[var(--accent-light)] cursor-pointer text-[var(--foreground)]'
                    : 'text-[var(--muted)] cursor-default',
              ].join(' ')}
            >
              {day}
              {hasSignals && (
                <span className={`w-[3px] h-[3px] rounded-full ${isSelected ? 'bg-white/60' : 'bg-[var(--accent)]'}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
