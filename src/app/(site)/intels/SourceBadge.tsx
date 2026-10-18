const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  x:           { label: 'X',           className: 'bg-black text-white' },
  github:      { label: 'GitHub',      className: 'bg-[#333] text-white' },
  arxiv:       { label: 'arXiv',       className: 'bg-[#b31b1b] text-white' },
  a16z:        { label: 'a16z',        className: 'bg-[#1a1a2e] text-white' },
  techcrunch:  { label: 'TC',          className: 'bg-[#0d9a0d] text-white' },
  ithome:      { label: 'IT之家',      className: 'bg-[#c00] text-white' },
  yc:          { label: 'YC',          className: 'bg-[#ff6600] text-white' },
  web:         { label: 'Web',         className: 'bg-[var(--subtle)] text-[var(--foreground)]' },
}

export function SourceBadge({ type }: { type: string }) {
  const badge = SOURCE_BADGE[type] ?? SOURCE_BADGE.web
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium leading-none ${badge.className}`}>
      {badge.label}
    </span>
  )
}
