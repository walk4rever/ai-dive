'use client'

import { useEffect, useState } from 'react'
import { findScrollContainer } from '@/lib/scroll-container'

const SHOW_AFTER_PX = 600

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 'scroll' doesn't bubble, but a capture-phase listener on document
    // still catches it from any scrollable descendant — including the
    // docked article's own overflow-y-auto box — so one listener covers
    // both the normal (window-scrolled) and docked layouts.
    function handleScroll(e: Event) {
      const top = e.target === document ? window.scrollY : (e.target as HTMLElement).scrollTop
      setVisible(top > SHOW_AFTER_PX)
    }
    document.addEventListener('scroll', handleScroll, true)
    return () => document.removeEventListener('scroll', handleScroll, true)
  }, [])

  if (!visible) return null

  function scrollToTop() {
    const container = findScrollContainer(document.querySelector('.prose'))
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="回到顶部"
      className="fixed bottom-6 left-6 z-30 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 15V3M9 3L4 8M9 3L14 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
