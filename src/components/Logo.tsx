interface LogoProps {
  size?: number
  showWordmark?: boolean
}

/**
 * AI-DIVE logo mark
 *
 * Container: filled rounded square in currentColor (app-icon style)
 * Mark: geometric abstraction of 早 (early/morning), inverted strokes
 *   日 (sun) — outer rectangle + inner horizontal
 *   十 (ground) — wide horizontal + short vertical descender
 */
export function Logo({ size = 26, showWordmark = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* container — filled rounded square */}
        <rect width="32" height="32" rx="7" fill="currentColor" />
        {/* 日 — outer rectangle */}
        <rect x="7" y="5" width="18" height="11" rx="1" stroke="var(--background)" strokeWidth="2" />
        {/* 日 — inner horizontal (bisects the rectangle) */}
        <line x1="7" y1="10.5" x2="25" y2="10.5" stroke="var(--background)" strokeWidth="2" />
        {/* 十 — long horizontal baseline */}
        <line x1="4" y1="20" x2="28" y2="20" stroke="var(--background)" strokeWidth="2" />
        {/* 十 — vertical descender */}
        <line x1="16" y1="20" x2="16" y2="27" stroke="var(--background)" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {showWordmark && (
        <span
          style={{ fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif', fontWeight: 600 }}
          className="text-xl tracking-tight leading-none"
        >
          AI-DIVE
        </span>
      )}
    </div>
  )
}
