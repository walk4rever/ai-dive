const DISPLAY_OVERRIDES: Record<string, string> = {
  '20vc': '20VC',
  'twiml ai': 'TWIML AI',
  'ai dive': 'AI-DIVE',
  'the a16z show': 'The a16z Show',
}

function normalizeAuthorKey(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
}

export function toAuthorSlug(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || null
}

export function toAuthorDisplay(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  const override = DISPLAY_OVERRIDES[normalizeAuthorKey(raw)]
  if (override) return override
  return raw
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ')
}
