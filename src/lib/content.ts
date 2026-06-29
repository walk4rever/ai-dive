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
