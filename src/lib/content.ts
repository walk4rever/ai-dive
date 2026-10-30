import type { PostContentType } from '@/types'

export function getTypeLabel(type: PostContentType | string | null): string {
  switch (type) {
    case 'dive': return '深度'
    case 'intel': return '情报'
    default: return ''
  }
}

// 2026-10-30 规范：source 列直接存来源名（20VC / Baseten / X.com…），无需再做显示名转换
export function getSourceLabel(source: string | null): string | null {
  return source?.trim() || null
}
