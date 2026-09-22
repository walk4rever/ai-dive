const DISPLAY_OVERRIDES: Record<string, string> = {
  '20vc': '20VC',
  'twiml ai': 'TWIML AI',
  'ai dive': 'AI-DIVE',
  'the a16z show': 'The a16z Show',
  'rafa': 'RAFA',
  'r129': 'R129',
}

export function stripWikilinks(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/[\[\]]/g, '')
    .trim()
}

function normalizeAuthorKey(value: string): string {
  return stripWikilinks(value).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
}

export function toAuthorSlug(value: string | null | undefined): string | null {
  const raw = stripWikilinks(value)
  if (!raw) return null
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || null
}

export function toAuthorDisplay(value: string | null | undefined): string | null {
  const raw = stripWikilinks(value)
  if (!raw) return null
  if (/^x@/i.test(raw)) return raw
  const override = DISPLAY_OVERRIDES[normalizeAuthorKey(raw)]
  if (override) return override
  return raw
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ')
}
