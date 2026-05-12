import { createClient } from '@supabase/supabase-js'

const SCORE_VERSION = 'v1'
const SCORER_NAME = 'rule-based-v1'

function getEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function parseArgs(argv) {
  const args = { dryRun: false, force: false, limit: 100, date: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--force') args.force = true
    else if (a === '--date') args.date = argv[++i] ?? null
    else if (a === '--limit') args.limit = Number(argv[++i] ?? '100')
  }
  return args
}

function includesAny(text, patterns) {
  return patterns.some((p) => p.test(text))
}

function countMatches(text, patterns) {
  return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0)
}

function clampScore(n) {
  return Math.max(0, Math.min(10, Math.round(n)))
}

function scoreInsight(signal) {
  const t = `${signal.title ?? ''} ${signal.description ?? ''}`.toLowerCase()
  const source = (signal.source_type ?? '').toLowerCase()
  const category = String(signal.metadata?.category ?? '').toLowerCase()

  const noveltyPatterns = [/首次|首个|突破|新范式|发布|推出|sota|state[- ]of[- ]the[- ]art|new model|new framework/i]
  const evidencePatterns = [/\d+(\.\d+)?%/, /\b\d+\s*(k|m|b|万|亿|小时|分钟|秒)\b/i, /benchmark|ablation|实验|研究|论文|报告/i]
  const depthPatterns = [/pipeline|架构|组件|工作流|multi-agent|多智能体|推理|显存|部署|配置/i]
  const clarityPatterns = [/意味着|价值|影响|为什么|适合|用于|场景/i]

  const novelty = includesAny(t, noveltyPatterns) ? 3 : 1
  const evidence = Math.min(3, countMatches(t, evidencePatterns))
  const depth = Math.min(2, countMatches(t, depthPatterns))

  let thesisShift = 1
  if (source === 'arxiv' || category === 'paper' || includesAny(t, [/新范式|sota|突破/i])) thesisShift = 3
  else if (category === 'ai-models' || category === 'industry') thesisShift = 2

  const clarity = includesAny(t, clarityPatterns) ? 2 : 1
  const score = clampScore(novelty + evidence + depth + thesisShift + clarity - 1)
  return {
    score,
    breakdown: {
      novelty_signal: novelty,
      evidence_presence: evidence,
      technical_depth: depth,
      thesis_shift: thesisShift,
      insight_clarity: clarity,
    },
  }
}

function scoreActionable(signal) {
  const t = `${signal.title ?? ''} ${signal.description ?? ''}`.toLowerCase()
  const url = String(signal.url ?? '').toLowerCase()

  const hasCode = /github\.com|gitlab\.com/.test(url)
  const hasDoc = /docs|guide|教程|步骤|配置|workflow|mcp|api/.test(t)
  const hasTryCue = /可用|试用|上线|open source|开源|release|v\d+/.test(t) || /releases\//.test(url)
  const hasConcreteSteps = /步骤|流程|pipeline|阶段|输入|输出|配置/.test(t)

  const executableAssets = hasCode ? 4 : hasTryCue ? 2 : 0
  const implementationSpecificity = hasConcreteSteps ? 3 : hasDoc ? 2 : 1
  const integrationCost = hasCode && hasDoc ? 2 : hasCode ? 1 : 0
  const summaryOperability = /如何|how to|用于|可在|即可/.test(t) ? 1 : 0

  const score = clampScore(executableAssets + implementationSpecificity + integrationCost + summaryOperability)
  return {
    score,
    breakdown: {
      has_executable_asset: executableAssets,
      implementation_specificity: implementationSpecificity,
      integration_cost: integrationCost,
      summary_operability: summaryOperability,
    },
  }
}

function scoreInfluence(signal) {
  const t = `${signal.title ?? ''} ${signal.description ?? ''}`.toLowerCase()
  const source = (signal.source_type ?? '').toLowerCase()
  const sourceName = String(signal.source_name ?? '').toLowerCase()
  const category = String(signal.metadata?.category ?? '').toLowerCase()

  let authority = 1
  if (source === 'arxiv' || source === 'hn' || source === 'github') authority = 3
  if (/openai|anthropic|google|microsoft|meta|hugging face|hacker news|arxiv/.test(sourceName)) authority = 4

  let audience = 1
  if (category === 'industry' || category === 'ai-models') audience = 3
  else if (category === 'ai-products' || category === 'paper') audience = 2

  const heatPatterns = [/gpt|claude|openai|anthropic|融资|tokens|benchmark|安全|agent|模型/i]
  const heat = includesAny(t, heatPatterns) ? 2 : 1

  const momentum = /趋势|持续|再次|继续|登顶|爆发|窗口期/.test(t) ? 1 : 0
  const score = clampScore(authority + audience + heat + momentum)
  return {
    score,
    breakdown: {
      source_authority: authority,
      audience_scope: audience,
      topic_heat_proxy: heat,
      narrative_momentum: momentum,
    },
  }
}

function buildReason(signal, insight, actionable, influence) {
  const parts = [
    `洞见${insight.score}`,
    `实践${actionable.score}`,
    `影响力${influence.score}`,
  ]
  const cat = signal.metadata?.category ? `，类别 ${signal.metadata.category}` : ''
  return `${parts.join(' / ')}${cat}。`
}

function scoreSignal(signal) {
  const insight = scoreInsight(signal)
  const actionable = scoreActionable(signal)
  const influence = scoreInfluence(signal)
  const reason = buildReason(signal, insight, actionable, influence)
  return {
    insight: insight.score,
    actionable: actionable.score,
    influence: influence.score,
    reason,
    score_meta: {
      score_version: SCORE_VERSION,
      scored_by: SCORER_NAME,
      insight_breakdown: insight.breakdown,
      actionable_breakdown: actionable.breakdown,
      influence_breakdown: influence.breakdown,
    },
    score_version: SCORE_VERSION,
    score_status: 'scored',
    scored_at: new Date().toISOString(),
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

  let query = supabase
    .from('ai_pulse_signals')
    .select('id,title,description,url,source_type,source_name,signal_date,metadata,insight,actionable,influence,status')
    .eq('status', 'enabled')
    .order('created_at', { ascending: false })
    .limit(args.limit)

  if (args.date) query = query.eq('signal_date', args.date)
  if (!args.force) query = query.or('insight.is.null,actionable.is.null,influence.is.null')

  const { data, error } = await query
  if (error) throw error

  const signals = data ?? []
  console.log(`[score-signals-v1] candidates=${signals.length} dryRun=${args.dryRun} force=${args.force}`)

  if (signals.length === 0) return

  for (const s of signals) {
    const patch = scoreSignal(s)
    if (args.dryRun) {
      console.log(JSON.stringify({ id: s.id, title: s.title, ...patch }, null, 2))
      continue
    }

    const { error: upsertErr } = await supabase
      .from('ai_pulse_signals')
      .update(patch)
      .eq('id', s.id)

    if (upsertErr) {
      console.error(`[score-signals-v1] update failed id=${s.id} ${upsertErr.message}`)
    } else {
      console.log(`[score-signals-v1] scored id=${s.id} insight=${patch.insight} actionable=${patch.actionable} influence=${patch.influence}`)
    }
  }
}

main().catch((err) => {
  console.error('[score-signals-v1] fatal', err)
  process.exit(1)
})
