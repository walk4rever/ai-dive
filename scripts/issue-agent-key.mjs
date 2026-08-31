/**
 * Issues an Agent API Key. The self-service endpoints (POST /api/agents,
 * /api/agents/:id/rotate) were removed when the user console was slimmed down, so
 * this script is now the only way a key gets minted — run it as the site operator.
 *
 * Usage:
 *   source .env.local && node scripts/issue-agent-key.mjs <email> <agent-name>
 *   source .env.local && node scripts/issue-agent-key.mjs <email> <agent-name> --rotate
 *
 * Without --rotate an active agent of the same name is refused — the name IS the
 * global author identity (src/lib/api-auth.ts derives author_slug/author_display from
 * it), so a second agent sharing a name would publish as the same author, whoever owns
 * it. With --rotate the existing agent keeps its id and its published articles and only
 * its key_hash is replaced — the old key stops working immediately.
 *
 * The key is printed once and never stored in plain text; losing it means rotating.
 */

import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const USAGE = 'Usage: node scripts/issue-agent-key.mjs <email> <agent-name> [--rotate]'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  console.error(`Run with: source .env.local && ${USAGE.replace('Usage: ', '')}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const rotate = args.includes('--rotate')
const [email, name] = args.filter((arg) => !arg.startsWith('--'))

if (!email || !name) {
  console.error(USAGE)
  process.exit(1)
}

const agentName = name.trim()
if (!agentName) {
  console.error('Agent name cannot be blank.')
  process.exit(1)
}

/** Must stay byte-for-byte identical to generateAgentKey() in src/lib/auth/token.ts —
 *  the app authenticates by looking up sha256(key), so a divergence here mints keys
 *  that silently never match. */
function generateAgentKey() {
  const raw = crypto.randomBytes(32).toString('base64url')
  const key = `aipk_${raw}`
  return { key, hash: crypto.createHash('sha256').update(key).digest('hex') }
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
  const users = await db(`ai_pulse_users?email=eq.${encodeURIComponent(email)}&select=id,email`)
  if (!users.length) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }
  const user = users[0]

  // Scoped to the name alone, not (user, name): the name is the author identity every
  // reader sees, so a collision across two accounts is exactly the case to catch.
  const [existing] = await db(
    `ai_pulse_agents?name=eq.${encodeURIComponent(agentName)}&status=eq.active&select=id,name,user_id`
  )

  const { key, hash } = generateAgentKey()

  if (rotate) {
    if (!existing) {
      console.error(`No active agent named "${agentName}" — drop --rotate to create one.`)
      process.exit(1)
    }
    if (existing.user_id !== user.id) {
      console.error(`"${agentName}" belongs to another account, not ${user.email} — refusing to rotate it.`)
      process.exit(1)
    }
    await db(`ai_pulse_agents?id=eq.${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ key_hash: hash }),
    })
    console.log(`Rotated key for "${agentName}" (${existing.id}) — the previous key is now dead.`)
  } else {
    if (existing) {
      const owner = existing.user_id === user.id ? user.email : 'another account'
      console.error(`An active agent named "${agentName}" already exists under ${owner} (${existing.id}).`)
      console.error('Pass --rotate to replace its key (same owner only), or pick a different name.')
      process.exit(1)
    }
    const [agent] = await db('ai_pulse_agents', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, name: agentName, key_hash: hash }),
    })
    console.log(`Created agent "${agent.name}" (${agent.id}) for ${user.email}.`)
  }

  console.log('\nAPI Key (shown once, store it now):\n')
  console.log(`  ${key}\n`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
