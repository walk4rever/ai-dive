import type { Metadata } from 'next'
import Link from 'next/link'
import { getWikiGraphData, CATEGORY_LABELS } from '@/lib/wiki'
import { WikiGraph } from '@/components/wiki/WikiGraph'

export const metadata: Metadata = {
  title: '知识图谱 · Wiki · AI-DIVE',
}

export const revalidate = 3600

export default async function WikiGraphPage() {
  const graphData = await getWikiGraphData()

  const nodeCount = graphData.nodes.length
  const linkCount = graphData.links.length

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--subtle)] mb-3">
            <Link href="/wiki" className="hover:text-[var(--accent)] transition-colors">
              Wiki
            </Link>
            <span>/</span>
            <span>知识图谱</span>
          </div>
          <h1 className="font-serif text-2xl font-medium text-[var(--foreground)] mb-1">
            知识图谱
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {nodeCount} 个节点 · {linkCount} 条链接 · 点击节点跳转页面
          </p>
        </div>
        <Link
          href="/wiki"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
        >
          ← 返回列表
        </Link>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: categoryColor(cat) }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* Graph Canvas */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden h-[600px]">
        <WikiGraph data={graphData} />
      </div>
    </div>
  )
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    entities: '#c96442',
    concepts: '#4a7c8e',
    comparisons: '#7a6e5f',
    queries: '#5a7a5a',
  }
  return map[category] ?? '#888'
}
