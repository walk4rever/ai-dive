'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export interface Signal {
  n: string
  source: 'HN' | 'GitHub' | 'arXiv'
  title: string
  desc: string
  url: string
}

export interface IntelDay {
  date: string
  overview: string
  keywords: string[]
  signals: Signal[]
  image_url?: string | null
}

interface Props {
  year: number
  month: number
  days: IntelDay[]
  initialDate?: string
}

const DOW = ['一', '二', '三', '四', '五', '六', '日']

const SOURCE_STYLE: Record<string, string> = {
  HN:     'text-[#ff6600] bg-[rgba(255,102,0,0.08)]',
  GitHub: 'text-[#333]    bg-[rgba(51,51,51,0.08)]',
  arXiv:  'text-[#b31b1b] bg-[rgba(179,27,27,0.08)]',
}

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

export function IntelCalendar({ year, month, days, initialDate }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const byDate = new Map(days.map((d) => [d.date, d]))
  const latest = days[0]?.date ?? null
  const [selected, setSelected] = useState<string | null>(
    initialDate && byDate.has(initialDate) ? initialDate : latest
  )

  const current = selected ? byDate.get(selected) ?? null : null
  const total = daysInMonth(year, month)
  const offset = startOffset(year, month)
  const monthLabel = `${year} 年 ${month} 月`
  const prev = shiftMonth(year, month, -1)
  const next = shiftMonth(year, month, 1)

  function goToMonth(y: number, m: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('m', `${y}-${pad(m)}`)
    params.delete('d')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div>
      {/* Top row: calendar + meta */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">

        {/* Calendar */}
        <div
          className="w-full sm:w-[280px] sm:shrink-0 border border-[var(--border-subtle)] rounded-2xl p-3 bg-white"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={() => goToMonth(prev.year, prev.month)}
              className="text-[0.8rem] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
              aria-label="上个月"
            >
              ‹
            </button>
            <span className="font-serif text-sm font-medium">{monthLabel}</span>
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
            {DOW.map((d) => (
              <div key={d} className="text-center text-[0.6rem] font-medium tracking-widest uppercase text-[var(--muted)] py-1">
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
                    'flex flex-col items-center justify-center gap-0.5 rounded-md h-7 text-[0.72rem] transition-colors',
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

        {/* Day meta */}
        {current ? (
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-baseline gap-2 flex-wrap mb-2">
              <span className="font-serif text-2xl font-medium tracking-tight">{current.date}</span>
              <span className="text-xs text-[var(--muted)]">· {current.signals.length} 条信号</span>
            </div>
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
            <p className="text-sm text-[var(--muted)] leading-relaxed">{current.overview}</p>
          </div>
        ) : (
          <div className="flex-1 pt-6 text-sm text-[var(--muted)]">选择一个日期查看情报</div>
        )}
      </div>

      {/* Infographic */}
      {current?.image_url && (
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.image_url}
            alt={`${current.date} 情报图`}
            className="w-full rounded-2xl border border-[var(--border-subtle)]"
          />
        </div>
      )}

      {/* Signal cards */}
      {current && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {current.signals.map((s) => (
            <a
              key={s.n}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-[var(--border-subtle)] rounded-xl p-4 bg-white hover:shadow-md hover:border-[var(--border)] transition-all flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.62rem] font-semibold tracking-wide text-[var(--muted)]">{s.n}</span>
                <span className={`text-[0.6rem] font-bold tracking-wider px-1.5 py-0.5 rounded ${SOURCE_STYLE[s.source] ?? 'text-[var(--muted)] bg-[var(--border-subtle)]'}`}>
                  {s.source}
                </span>
              </div>
              <div className="text-sm font-medium leading-snug text-[var(--foreground)]">{s.title}</div>
              <div className="text-xs text-[var(--muted)] leading-relaxed flex-1">{s.desc}</div>
              <div className="text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                阅读原文 →
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
