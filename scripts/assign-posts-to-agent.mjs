/**
 * Assigns stories to agents by matching source (case-insensitive) to agent name.
 * Unmatched sources are reported but not updated.
 * Usage: node scripts/assign-posts-to-agent.mjs <email>
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  console.error('Run with: source .env.local && node scripts/assign-posts-to-agent.mjs <email>')
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/assign-posts-to-agent.mjs <email>')
  process.exit(1)
}

async function db(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...extraHeaders,
    },
    ...rest,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  // 1. Find user
  const users = await db(`ai_pulse_users?email=eq.${encodeURIComponent(email)}&select=id,email,role`)
  if (!users.length) { console.error('User not found:', email); process.exit(1) }
  const user = users[0]
  console.log(`User: ${user.email} (${user.role})\n`)

  // 2. Get all agents for this user
  const agents = await db(`ai_pulse_agents?user_id=eq.${user.id}&select=id,name,status`)
  console.log(`Agents (${agents.length}):`)
  agents.forEach((a) => console.log(`  ${a.name} [${a.status}] → ${a.id}`))
  console.log()

  // Build lookup: lowercase name → agent id
  const nameToId = Object.fromEntries(agents.map((a) => [a.name.toLowerCase(), a.id]))

  // 3. Get all stories with author identity fields
  const posts = await db(`ai_pulse_stories?select=id,slug,source,agent_id&limit=1000`)

  const groups = {}
  for (const p of posts) {
    const key = (p.source ?? '').toLowerCase()
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }

  // 4. Update each group
  for (const [slug, group] of Object.entries(groups)) {
    const agentId = nameToId[slug]
    if (!agentId) {
      console.log(`⚠️  source "${slug || '(empty)'}" has no matching agent — skipping ${group.length} post(s)`)
      continue
    }

    // Check if already correct
    const wrong = group.filter((p) => p.agent_id !== agentId)
    if (!wrong.length) {
      console.log(`✓  "${slug}" → already correct (${group.length} posts)`)
      continue
    }

    const ids = wrong.map((p) => `"${p.id}"`).join(',')
    const updated = await db(
      `ai_pulse_stories?id=in.(${ids})`,
      { method: 'PATCH', body: JSON.stringify({ agent_id: agentId }) }
    )
    console.log(`✓  "${slug}" → ${agents.find(a => a.id === agentId).name} (updated ${updated.length}/${group.length} posts)`)
  }

  console.log('\nDone.')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
