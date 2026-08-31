import type { ReactNode } from 'react'

interface CardProps {
  /** Omit for a plain content shell with no header row. */
  kicker?: string
  /** Right-aligned counterweight to the kicker — a count, a period, a status. */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** The one card shell every console panel uses (user dashboard and admin alike):
 *  contained (Level 1) border, 12px radius, 24–32px internal padding — DESIGN.md
 *  「Cards & Containers」. Kept presentational and server-rendered; only the panels
 *  that own form state opt into 'use client'. */
export function Card({ kicker, aside, className = '', children }: CardProps) {
  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--border)] p-6 md:p-8 ${className}`}>
      {kicker && (
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="kicker">{kicker}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}
