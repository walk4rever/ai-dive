interface ListPageHeaderProps {
  kicker: string
  title: string
  description?: string
  count?: number
  hideBorder?: boolean
}

export function ListPageHeader({ kicker, title, description, count, hideBorder = false }: ListPageHeaderProps) {
  return (
    <header className={`${hideBorder ? 'pb-0 mb-6' : 'pb-10 mb-14 border-b border-[var(--border)]'}`}>
      <p className="kicker mb-5" style={{ color: 'var(--accent)' }}>
        {kicker}
      </p>
      <h1 className="font-serif text-4xl md:text-5xl font-medium leading-[1.15] tracking-tight text-[var(--foreground)]">
        {title}
      </h1>
      {description && (
        <p className="mt-6 text-base md:text-lg text-[var(--muted)] leading-relaxed">
          {description}
        </p>
      )}
      {typeof count === 'number' && (
        <p className="mt-6 date">共 {count} 篇</p>
      )}
    </header>
  )
}
