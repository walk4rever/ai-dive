import type { PostContentType } from '@/types'

export function getTypeLabel(type: PostContentType | string | null): string {
  switch (type) {
    case 'tech': return '深度'
    case 'case': return '案例'
    case 'intel': return '情报'
    case 'insight': return '洞见'
default: return ''
  }
}

const SOURCE_LABEL_OVERRIDES: Record<string, string> = {
  '20vc': '20VC',
  'twiml ai': 'TWIML AI',
}

export function getSourceLabel(authorSlug: string | null): string | null {
  if (!authorSlug) return null
  const normalized = authorSlug.trim().toLowerCase().replace(/-/g, ' ')
  if (SOURCE_LABEL_OVERRIDES[normalized]) return SOURCE_LABEL_OVERRIDES[normalized]
  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
