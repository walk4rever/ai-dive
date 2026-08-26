'use client'

import { useEffect, useRef, useState } from 'react'
import type { ArticleHeading } from '@/lib/extract-headings'

const MIN_HEADINGS_TO_SHOW = 3

interface ArticleTocProps {
  headings: ArticleHeading[]
}

export function ArticleToc({ headings }: ArticleTocProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  if (headings.length < MIN_HEADINGS_TO_SHOW) return null

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="fixed left-6 top-6 z-30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="文章目录"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <line x1="1" y1="3" x2="17" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="1" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <nav
          className="mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-2xl p-4 shadow-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          aria-label="文章目录"
        >
          <p className="kicker mb-3" style={{ color: 'var(--accent)' }}>目录</p>
          <ul className="flex flex-col gap-1">
            {headings.map((heading) => (
              <li key={heading.id}>
                <button
                  type="button"
                  onClick={() => goTo(heading.id)}
                  className="block w-full py-1.5 text-left text-sm leading-snug transition-colors hover:text-[var(--accent)]"
                  style={{
                    color: 'var(--muted)',
                    paddingLeft: heading.level === 3 ? '1rem' : 0,
                  }}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
