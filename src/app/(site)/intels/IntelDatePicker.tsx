'use client'

import { useEffect, useRef, useState } from 'react'
import { IntelCalendar, type IntelDay } from './IntelCalendar'

let pickerOpen = false

interface Props {
  year: number
  month: number
  days: IntelDay[]
  date: string
}

export function IntelDatePicker({ year, month, days, date }: Props) {
  const [open, setOpenState] = useState(pickerOpen)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        pickerOpen = false
        setOpenState(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        pickerOpen = false
        setOpenState(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="选择情报日期"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="intel-date-picker"
        title="选择日期"
        onClick={() => {
          pickerOpen = !open
          setOpenState(!open)
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
        </svg>
      </button>

      {open && (
        <div
          id="intel-date-picker"
          role="dialog"
          aria-label="选择情报日期"
          className="absolute right-0 top-full z-40 mt-3 w-[min(320px,calc(100vw-3rem))] rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-[0_16px_48px_rgba(20,20,19,0.14)]"
        >
          <IntelCalendar
            key={`${year}-${month}-${date}`}
            year={year}
            month={month}
            days={days}
            initialDate={date}
            monthParam="m"
            onDateNavigate={() => {
              pickerOpen = false
              setOpenState(false)
            }}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}
