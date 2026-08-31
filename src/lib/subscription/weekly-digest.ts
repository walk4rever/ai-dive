import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysYmd, getTodayYmd, parseYmd } from '@/lib/timezone'

export interface DigestSignal {
  label: string
  title: string
  description: string
  url: string
  sourceName: string | null
}

export interface DigestPost {
  slug: string
  title: string
  excerpt: string
  contentType: 'dive' | 'insight'
}

export interface DigestDeck {
  title: string
  description: string
  kicker: string
  priceCents: number
  currency: string
}

export interface WeeklyDigestData {
  periodStart: string
  periodEnd: string
  topSignals: DigestSignal[]
  recentPosts: DigestPost[]
  paidDecks: DigestDeck[]
}

const DIMENSIONS: ReadonlyArray<{ key: 'insight' | 'actionable' | 'influence'; label: string }> = [
  { key: 'insight', label: '洞见' },
  { key: 'actionable', label: '实践' },
  { key: 'influence', label: '影响' },
]

interface RawSignal {
  id: string
  title: string
  description: string
  url: string
  source_name: string | null
  insight: number | null
  actionable: number | null
  influence: number | null
}

/** Last full calendar week (Monday–Sunday), not a rolling "today minus 7 days" —
 *  the current, still-in-progress week is deliberately excluded so an issue sent
 *  mid-week doesn't claim signals from days that haven't happened yet relative to
 *  its own "past week" framing. Dates are calendar values in APP_TIME_ZONE (see
 *  src/lib/timezone.ts), matching how signal_date itself is anchored, not raw UTC —
 *  computing this in UTC would occasionally land on the wrong Monday for a reader in
 *  Asia/Shanghai near local midnight. */
export function lastCalendarWeek(): { periodStart: string; periodEnd: string } {
  const today = getTodayYmd()
  const parsed = parseYmd(today)
  if (!parsed) throw new Error(`getTodayYmd() returned an unparseable date: ${today}`)

  // JS getUTCDay(): 0=Sunday..6=Saturday. Constructing from the already-timezone-
  // resolved y/m/d and reading it back in UTC is safe here — it's pure calendar math,
  // not a real instant, so there's no DST/offset ambiguity to worry about.
  const dayOfWeek = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisMonday = addDaysYmd(today, -daysSinceMonday)

  return {
    periodStart: addDaysYmd(thisMonday, -7),
    periodEnd: addDaysYmd(thisMonday, -1),
  }
}

/** Live data for last week — nothing here is cached or frozen at issue creation time,
 *  so a preview reflects whatever's actually in the DB right now for that window.
 *  信号解读 picks one signal per dimension (insight/actionable/influence), highest
 *  score wins — same algorithm as SignalHighlights.tsx on /intels, restricted to
 *  score_status='scored' so a just-ingested signal that hasn't been scored yet
 *  doesn't show up as a false zero. */
export async function fetchWeeklyDigestData(supabase: SupabaseClient): Promise<WeeklyDigestData> {
  const { periodStart, periodEnd } = lastCalendarWeek()

  const [{ data: scoredSignals }, { data: posts }, { data: decks }] = await Promise.all([
    supabase
      .from('ai_pulse_signals')
      .select('id, title, description, url, source_name, insight, actionable, influence')
      .eq('status', 'enabled')
      .eq('score_status', 'scored')
      .gte('signal_date', periodStart)
      .lte('signal_date', periodEnd),
    supabase
      .from('ai_pulse_stories')
      .select('slug, title, excerpt, content_type')
      .eq('status', 'published')
      .in('content_type', ['dive', 'insight'])
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('ai_pulse_decks')
      .select('title, description, kicker, price_cents, currency')
      .eq('status', 'published')
      .not('price_cents', 'is', null)
      .order('date', { ascending: false }),
  ])

  const pool = (scoredSignals ?? []) as RawSignal[]
  const excludeIds = new Set<string>()
  const topSignals: DigestSignal[] = []
  for (const { key, label } of DIMENSIONS) {
    const candidates = pool
      .filter((s) => !excludeIds.has(s.id) && typeof s[key] === 'number')
      .sort((a, b) => (b[key] as number) - (a[key] as number))
    const signal = candidates[0]
    if (signal) {
      excludeIds.add(signal.id)
      topSignals.push({
        label,
        title: signal.title,
        description: signal.description,
        url: signal.url,
        sourceName: signal.source_name,
      })
    }
  }

  return {
    periodStart,
    periodEnd,
    topSignals,
    recentPosts: (posts ?? []).map((p) => ({
      slug: p.slug as string,
      title: p.title as string,
      excerpt: p.excerpt as string,
      contentType: p.content_type as 'dive' | 'insight',
    })),
    paidDecks: (decks ?? []).map((d) => ({
      title: d.title as string,
      description: d.description as string,
      kicker: d.kicker as string,
      priceCents: d.price_cents as number,
      currency: d.currency as string,
    })),
  }
}

export interface WeekSignalForSummary {
  title: string
  description: string
  sourceName: string | null
}

/** The broader pool an LLM summarizes from — deliberately not the same 3 cards
 *  topSignals picks for display. Those 3 are "one highest score per dimension";
 *  a good weekly summary needs the week's actual spread of themes, not just its
 *  three most extreme outliers. Capped and sorted by combined score so a heavy week
 *  still gives the model the most substantive items first if it has to truncate. */
export async function fetchWeekSignalsForSummary(
  supabase: SupabaseClient,
  limit = 80
): Promise<WeekSignalForSummary[]> {
  const { periodStart, periodEnd } = lastCalendarWeek()

  const { data } = await supabase
    .from('ai_pulse_signals')
    .select('title, description, source_name, insight, actionable, influence')
    .eq('status', 'enabled')
    .eq('score_status', 'scored')
    .gte('signal_date', periodStart)
    .lte('signal_date', periodEnd)

  const rows = (data ?? []) as Array<{
    title: string
    description: string
    source_name: string | null
    insight: number | null
    actionable: number | null
    influence: number | null
  }>

  rows.sort((a, b) => {
    const scoreA = (a.insight ?? 0) + (a.actionable ?? 0) + (a.influence ?? 0)
    const scoreB = (b.insight ?? 0) + (b.actionable ?? 0) + (b.influence ?? 0)
    return scoreB - scoreA
  })

  return rows.slice(0, limit).map((r) => ({
    title: r.title,
    description: r.description,
    sourceName: r.source_name,
  }))
}

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

function formatPrice(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2)
  return currency === 'CNY' ? `¥${amount}` : `${currency} ${amount}`
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
}

/** The 信号解读 summary is written (or AI-generated, see /api/admin/newsletter/
 *  generate-summary) as 2-3 short paragraphs separated by a blank line — a single
 *  <p> would collapse those line breaks into nothing, since HTML (and email clients)
 *  ignore literal newlines. Splits on blank lines and renders each paragraph as its
 *  own <p>; a summary with no blank lines at all (a one-paragraph fallback, or older
 *  hand-written text from before this was multi-paragraph) still renders as one. */
function renderParagraphs(text: string, color: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.85;color:${color};">${esc(p)}</p>`)
    .join('')
}

const COLOR = {
  background: '#faf9f5',
  surface: '#f5f4ed',
  foreground: '#141413',
  foregroundSoft: '#3d3d3a',
  muted: '#5e5d59',
  subtle: '#87867f',
  accent: '#c96442',
  border: '#e8e6dc',
  borderSubtle: '#f0eee6',
} as const
const SERIF = "Georgia, 'Noto Serif SC', 'Songti SC', 'STSong', serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', Helvetica, Arial, sans-serif"
const CONTENT_WIDTH = 680
const SIDE_PAD = 40
const GUTTER = 24

function kicker(text: string, color: string = COLOR.accent): string {
  return `<p style="margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${color};">${esc(text)}</p>`
}

/** A bordered pill, distinct from the plain-text kicker() above — used for per-item
 *  type tags (深度/洞见, a deck's kicker taxonomy) so they read as "tag on this card"
 *  rather than "heading of this section". Same rounded-pill idiom as the admin
 *  console's status badges (src/components/dashboard/OrdersCard.tsx). */
function pill(text: string, color: string): string {
  return `<span style="display:inline-block;padding:3px 11px;border:1px solid ${color};border-radius:999px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.03em;color:${color};">${esc(text)}</span>`
}

function sectionHeading(title: string, subtitle?: string): string {
  return `
    <tr><td style="padding:48px ${SIDE_PAD}px 6px;border-top:1px solid ${COLOR.border};">
      ${kicker(title)}
      ${subtitle ? `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${COLOR.muted};">${esc(subtitle)}</p>` : ''}
    </td></tr>
  `
}

function signalCard(signal: DigestSignal): string {
  const trimmed = signal.description.length > 110 ? `${signal.description.slice(0, 110)}…` : signal.description
  return `
    <tr><td style="padding:22px 26px;border:1px solid ${COLOR.borderSubtle};background:${COLOR.background};border-radius:12px;">
      <div style="margin:0 0 12px;">${pill(signal.label, COLOR.accent)}</div>
      <a href="${esc(signal.url)}" style="display:block;font-family:${SANS};font-size:16px;font-weight:600;line-height:1.5;color:${COLOR.foreground};text-decoration:none;margin:0 0 8px;">${esc(signal.title)}</a>
      ${signal.description ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:14px;line-height:1.75;color:${COLOR.muted};">${esc(trimmed)}</p>` : ''}
      ${signal.sourceName ? `<p style="margin:0;font-family:${SANS};font-size:12px;color:${COLOR.subtle};">${esc(signal.sourceName)}</p>` : ''}
    </td></tr>
    <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
  `
}

const TYPE_LABEL: Record<DigestPost['contentType'], string> = { dive: '深度', insight: '洞见' }

function postCard(post: DigestPost, siteUrl: string): string {
  const url = `${siteUrl}/post/${post.slug}`
  return `
    <tr><td style="padding:22px 26px;border:1px solid ${COLOR.borderSubtle};background:${COLOR.background};border-radius:12px;">
      <div style="margin:0 0 12px;">${pill(TYPE_LABEL[post.contentType], COLOR.subtle)}</div>
      <a href="${esc(url)}" style="display:block;font-family:${SERIF};font-size:20px;font-weight:600;line-height:1.4;color:${COLOR.foreground};text-decoration:none;margin:0 0 8px;">${esc(post.title)}</a>
      ${post.excerpt ? `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.75;color:${COLOR.muted};">${esc(post.excerpt)}</p>` : ''}
      <a href="${url}" style="font-family:${SANS};font-size:13px;font-weight:600;color:${COLOR.accent};text-decoration:none;">阅读全文 →</a>
    </td></tr>
    <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
  `
}

function deckCard(deck: DigestDeck, siteUrl: string): string {
  const url = `${siteUrl}/decks`
  return `
    <tr><td style="padding:22px 26px;border:1px solid ${COLOR.borderSubtle};background:${COLOR.background};border-radius:12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>${pill(deck.kicker, COLOR.subtle)}</td>
        <td align="right" style="font-family:${SANS};font-size:15px;font-weight:700;color:${COLOR.accent};white-space:nowrap;">${esc(formatPrice(deck.priceCents, deck.currency))}</td>
      </tr></table>
      <a href="${url}" style="display:block;font-family:${SERIF};font-size:20px;font-weight:600;line-height:1.4;color:${COLOR.foreground};text-decoration:none;margin:12px 0 8px;">${esc(deck.title)}</a>
      <p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.75;color:${COLOR.muted};">${esc(deck.description)}</p>
      <a href="${url}" style="font-family:${SANS};font-size:13px;font-weight:600;color:${COLOR.accent};text-decoration:none;">查看详情 →</a>
    </td></tr>
    <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
  `
}

export interface BuildDigestParams {
  data: WeeklyDigestData
  /** Written by an admin in the /admin/newsletter form — there's no auto-generation
   *  yet, so this is required, not derived from the signals. */
  summary: string
  siteUrl: string
  /** Omit for a preview render (no real recipient to sign a link for) — the footer
   *  falls back to a plain /subscribe link instead of a broken unsubscribe URL. */
  unsubscribeUrl?: string
}

/** DECKS_SUBTITLE mirrors the /decks page's own tagline verbatim (ListPageHeader's
 *  description prop in src/app/(site)/decks/page.tsx) rather than a paraphrase, per
 *  explicit request — short enough to read fine as an email subtitle unlike the
 *  /dives and /insights taglines, which run long. */
const DECKS_SUBTITLE = '将深度思考浓缩为极具传播力的视觉产品——幻灯片、报告、交互式解读，加速前沿知识的流动。'

export function buildWeeklyDigestHtml({ data, summary, siteUrl, unsubscribeUrl }: BuildDigestParams): string {
  const issueLabel = `${formatDateShort(data.periodStart)} – ${formatDateShort(data.periodEnd)}`
  const footerUnsubscribe = unsubscribeUrl ?? `${siteUrl}/subscribe`

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI-DIVE 周刊</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.surface};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    本周信号解读、3 篇深度阅读、热门出品一次看完。
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.surface};">
    <tr><td align="center" style="padding:${GUTTER}px 16px;">
      <table role="presentation" width="${CONTENT_WIDTH}" cellpadding="0" cellspacing="0" style="width:${CONTENT_WIDTH}px;max-width:100%;background:${COLOR.background};">
        <tr><td style="padding:44px ${SIDE_PAD}px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>${kicker('AI-DIVE 周刊')}</td>
            <td align="right" style="font-family:${SANS};font-size:13px;color:${COLOR.subtle};white-space:nowrap;">${esc(issueLabel)}</td>
          </tr></table>
          <h1 style="margin:2px 0 0;font-family:${SERIF};font-size:34px;font-weight:600;line-height:1.25;color:${COLOR.foreground};">本周 AI 信号与深度</h1>
        </td></tr>

        ${sectionHeading('信号解读')}
        <tr><td style="padding:16px ${SIDE_PAD}px 0;">
          <div style="margin:0 0 8px;">${renderParagraphs(summary, COLOR.foregroundSoft)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${data.topSignals.map(signalCard).join('')}
          </table>
        </td></tr>

        ${sectionHeading('深度阅读', '从深度剖析到一线访谈，还原产品与技术决策背后的真实逻辑。')}
        <tr><td style="padding:16px ${SIDE_PAD}px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${data.recentPosts.map((p) => postCard(p, siteUrl)).join('')}
          </table>
        </td></tr>

        ${sectionHeading('热门出品', DECKS_SUBTITLE)}
        <tr><td style="padding:16px ${SIDE_PAD}px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${data.paidDecks.map((d) => deckCard(d, siteUrl)).join('')}
          </table>
        </td></tr>

        <tr><td style="padding:44px ${SIDE_PAD}px 40px;border-top:1px solid ${COLOR.border};margin-top:20px;">
          <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:1.7;color:${COLOR.subtle};">
            感谢你注册并订阅 AI-DIVE——我们会持续打磨每一期内容，把真正重要的信号和判断带给你。
          </p>
          <p style="margin:0 0 16px;font-family:${SANS};font-size:12px;line-height:1.7;color:${COLOR.subtle};">
            如果不再需要，可以随时 <a href="${esc(footerUnsubscribe)}" style="color:${COLOR.subtle};text-decoration:underline;">取消订阅</a>。
          </p>
          <p style="margin:0;font-family:${SANS};font-size:12px;color:${COLOR.subtle};">AI-DIVE © 2026 · Powered by Air7.fun</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildWeeklyDigestText({ data, summary, siteUrl, unsubscribeUrl }: BuildDigestParams): string {
  const issueLabel = `${formatDateShort(data.periodStart)} – ${formatDateShort(data.periodEnd)}`
  const footerUnsubscribe = unsubscribeUrl ?? `${siteUrl}/subscribe`

  const lines = [
    `AI-DIVE 周刊 · ${issueLabel}`,
    '',
    '# 信号解读',
    summary,
    ...data.topSignals.map((s) => `\n[${s.label}] ${s.title}\n${s.url}`),
    '',
    '# 深度阅读',
    ...data.recentPosts.map((p) => `\n${TYPE_LABEL[p.contentType]} | ${p.title}\n${siteUrl}/post/${p.slug}`),
    '',
    '# 热门出品',
    ...data.paidDecks.map((d) => `\n${d.title} (${formatPrice(d.priceCents, d.currency)})\n${siteUrl}/decks`),
    '',
    '---',
    '感谢你注册并订阅 AI-DIVE——我们会持续打磨每一期内容，把真正重要的信号和判断带给你。',
    `取消订阅: ${footerUnsubscribe}`,
  ]
  return lines.join('\n')
}

export function weeklyDigestSubject(data: WeeklyDigestData): string {
  return `AI-DIVE 周刊 · ${formatDateShort(data.periodStart)} – ${formatDateShort(data.periodEnd)}`
}
