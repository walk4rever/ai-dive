import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { fetchWeekSignalsForSummary, lastCalendarWeek } from '@/lib/subscription/weekly-digest'

export const maxDuration = 90

const GATEWAY_URL = process.env.AI_DIVE_AGENT_GATEWAY_URL
const AGENT_SECRET = process.env.AI_DIVE_AGENT_SECRET

function buildPrompt(periodStart: string, periodEnd: string, signals: { title: string; description: string; sourceName: string | null }[]) {
  const list = signals
    .map((s, i) => `${i + 1}. [${s.sourceName ?? '未知来源'}] ${s.title}${s.description ? ` — ${s.description}` : ''}`)
    .join('\n')

  return (
    `你是 AI-DIVE 的编辑助手。下面是过去一周（${periodStart} 至 ${periodEnd}）AI 领域的信号列表，` +
    '每条包含来源、标题和简介。请直接根据这些信息写一段有条理的中文解读，总结这一周最值得关注的几条主线' +
    '（例如某几家公司的产品/模型动态、行业与资本层面的动向、安全与治理方面的争议或事件等），' +
    '按信息本身的实际分量归纳，不要为了凑够几条主线而夸大或编造。\n\n' +
    '格式要求：全文不超过 300 字；按主线适度分成 2 到 3 段，段落之间用一个空行分隔；' +
    '每段内部是连贯的句子，不要在段落内部使用编号或项目符号列表；' +
    '只输出解读正文本身，不要加标题、不要用 Markdown 格式（不要 #、*、- 这类符号），不要加"以下是摘要"或引号之类的开场白或收尾语。\n\n' +
    `信号列表：\n${list}`
  )
}

interface GatewayEvent {
  type: string
  data: Record<string, unknown>
}

function parseSseEvents(raw: string): GatewayEvent[] {
  const events: GatewayEvent[] = []
  let eventType = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      try {
        events.push({ type: eventType, data: JSON.parse(line.slice(5).trim()) })
      } catch {
        // malformed data line — skip rather than fail the whole parse
      }
    }
  }
  return events
}

/** One-shot, stateless use of pi-gateway's /chat — not the persistent per-user
 *  session the /agent page and article AI解读 panel use. A fresh, random userId on
 *  every call means pi-gateway always starts a brand-new in-memory session with no
 *  prior turns to get confused by (this route is stateless by design: click it twice,
 *  get two independent completions, not a continued conversation). Everything the
 *  model needs is inlined into the prompt, so it has no real reason to reach for its
 *  tools (search-ai-dive, analyze-github, etc.) — if it does anyway, that shows up as
 *  a tool_start/tool_end event this route just ignores while still waiting for the
 *  final text, since the tool call itself isn't a failure, just unexpected. This isn't
 *  metered against anyone's credit balance — it's an admin-only editorial utility, not
 *  the public-facing chat surface credits.ts exists to ration. */
export async function POST() {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GATEWAY_URL || !AGENT_SECRET) {
    return NextResponse.json({ error: 'Agent not configured' }, { status: 503 })
  }

  const { periodStart, periodEnd } = lastCalendarWeek()
  const supabase = await createServiceClient()
  const signals = await fetchWeekSignalsForSummary(supabase)

  if (signals.length === 0) {
    return NextResponse.json({ error: '这一周（周一至周日）没有已评分的信号，没有可总结的内容' }, { status: 422 })
  }

  const message = buildPrompt(periodStart, periodEnd, signals)

  let upstream: Response
  try {
    upstream = await fetch(`${GATEWAY_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Secret': AGENT_SECRET },
      body: JSON.stringify({ message, userId: crypto.randomUUID(), articleSlug: 'newsletter-digest-summary' }),
      signal: AbortSignal.timeout(85_000),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Gateway request failed' }, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    return NextResponse.json({ error: errText || `Gateway error ${upstream.status}` }, { status: 502 })
  }

  const raw = await upstream.text()
  const events = parseSseEvents(raw)

  const errorEvent = events.find((e) => e.type === 'error')
  if (errorEvent) {
    return NextResponse.json({ error: typeof errorEvent.data.message === 'string' ? errorEvent.data.message : '生成失败' }, { status: 502 })
  }

  const summary = events
    .filter((e) => e.type === 'delta')
    .map((e) => (typeof e.data.text === 'string' ? e.data.text : ''))
    .join('')
    .trim()

  if (!summary) {
    return NextResponse.json({ error: '模型没有返回任何内容，请重试' }, { status: 502 })
  }

  return NextResponse.json({ summary })
}
