interface LogoProps {
  size?: number
  showWordmark?: boolean
  className?: string
}

/**
 * AI-DIVE logo mark
 *
 * Air7.fun unified brand "7 in flight / A" mark
 * Container: Terracotta (#c96442) Squircle (rx 112)
 * Mark: Pure White (#ffffff) 7-in-flight path + A-crossbar
 */
export function Logo({ size = 26, showWordmark = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Terracotta (#c96442) Squircle background */}
        <rect width="512" height="512" rx="112" fill="#c96442" />

        {/* Air7.fun "7 in flight" / "A" in Pure White */}
        <path
          d="M 88 174 L 418 108 L 192 408"
          fill="none"
          stroke="#ffffff"
          strokeWidth="58"
          strokeLinecap="round"
          strokeLinejoin="miter"
          strokeMiterlimit="10"
        />

        <line
          x1="142"
          y1="258"
          x2="348"
          y2="258"
          stroke="#ffffff"
          strokeWidth="42"
          strokeLinecap="round"
        />
      </svg>

      {showWordmark && (
        <span
          style={{ fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif', fontWeight: 600 }}
          className="text-xl tracking-tight leading-none text-[var(--foreground)]"
        >
          AI-DIVE
        </span>
      )}
    </div>
  )
}
