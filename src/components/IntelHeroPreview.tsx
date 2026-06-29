'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { IntelDay } from '@/app/intels/IntelCalendar'

interface Props {
  year: number
  month: number
  days: IntelDay[]
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
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function IntelHeroPreview({ year, month, days }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const byDate = new Map(days.map((d) => [d.date, d]))
  const latest = days[0]?.date ?? null
  const [selected, setSelected] = useState<string | null>(latest)

  const current = selected ? (byDate.get(selected) ?? null) : null
  const total = daysInMonth(year, month)
  const offset = startOffset(year, month)
  const prev = shiftMonth(year, month, -1)
  const next = shiftMonth(year, month, 1)

  function goToMonth(y: number, m: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('im', `${y}-${pad(m)}`)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mt-10 flex flex-col sm:flex-row items-start gap-6">
      {/* Mini calendar */}
      <div className="w-full sm:w-[240px] sm:shrink-0 border border-[var(--border-subtle)] rounded-2xl p-3 bg-[var(--background)]">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToMonth(prev.year, prev.month)}
              className="text-[0.7rem] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
              aria-label="上个月"
            >
              ‹
            </button>
            <span className="text-xs font-medium text-[var(--muted)]">{year} 年 {month} 月</span>
            <button
              type="button"
              onClick={() => goToMonth(next.year, next.month)}
              className="text-[0.7rem] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
              aria-label="下个月"
            >
              ›
            </button>
          </div>
          <Link href="/intels" className="text-[0.65rem] text-[var(--accent)] hover:underline">
            全部情报 →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-px">
          {DOW.map((d) => (
            <div key={d} className="text-center text-[0.55rem] font-medium tracking-widest text-[var(--muted)] py-0.5">
              {d}
            </div>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: total }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${pad(month)}-${pad(day)}`
            const has = byDate.has(dateStr)
            const isSelected = selected === dateStr
            return (
              <button
                key={day}
                onClick={() => has && setSelected(dateStr)}
                className={[
                  'flex flex-col items-center justify-center gap-0.5 rounded-md h-6 text-[0.65rem] transition-colors',
                  isSelected
                    ? 'bg-[var(--accent)] text-white'
                    : has
                      ? 'hover:bg-[var(--accent-light)] cursor-pointer text-[var(--foreground)]'
                      : 'text-[var(--muted)] cursor-default',
                ].join(' ')}
              >
                {day}
                {has && (
                  <span className={`w-[3px] h-[3px] rounded-full ${isSelected ? 'bg-white/60' : 'bg-[var(--accent)]'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day summary */}
      {current ? (
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-2">
            <span className="kicker" style={{ color: 'var(--accent)' }}>今日情报</span>
            <span className="text-xs text-[var(--muted)]">{current.date}</span>
          </div>
          {current.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {current.keywords.map((k) => (
                <span
                  key={k}
                  className="text-[0.65rem] font-medium tracking-wide text-[var(--accent)] bg-[var(--accent-light)] border border-[rgba(201,100,66,0.15)] px-2 py-0.5 rounded-full"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-[var(--muted)] leading-relaxed line-clamp-4">{current.overview}</p>
          <Link
            href={`/intels?d=${current.date}`}
            className="inline-flex items-center mt-4 text-sm text-[var(--accent)] hover:underline"
          >
            查看完整情报 →
          </Link>
        </div>
      ) : (
        <div className="flex-1 pt-2 text-sm text-[var(--muted)]">暂无情报</div>
      )}
    </div>
  )
}
