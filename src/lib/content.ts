import type { PostContentType } from '@/types'

export function getTypeLabel(type: PostContentType | string | null): string {
  switch (type) {
    case 'analysis': return '深度'
    case 'case': return '案例'
    case 'intel': return '情报'
    case 'podcast': return '洞见'
    case 'invest': return '投资'
    default: return ''
  }
}
