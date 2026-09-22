import type { PostContentType } from '@/types'
import { toAuthorDisplay } from '@/lib/author'

export function getTypeLabel(type: PostContentType | string | null): string {
  switch (type) {
    case 'dive': return '深度'
    case 'intel': return '情报'
    case 'insight': return '洞见'
    default: return ''
  }
}

export function getSourceLabel(authorSlug: string | null): string | null {
  return toAuthorDisplay(authorSlug)
}
