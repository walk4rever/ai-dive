'use client'

import { useState } from 'react'

/** Copies the raw Markdown source of a finished assistant reply. Shared by
 *  AgentChat and ArticleChatPanel so the two chat surfaces stay in sync. */
export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      aria-label={copied ? '已复制' : '复制'}
      title={copied ? '已复制' : '复制'}
      className="mt-1.5 flex items-center justify-center transition-colors"
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '6px',
        color: '#87867f',
        background: 'transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#faf9f5'
        e.currentTarget.style.color = '#141413'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#87867f'
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3.5 10.5V3.5a1 1 0 0 1 1-1h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
