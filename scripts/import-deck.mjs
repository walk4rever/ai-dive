#!/usr/bin/env node
/**
 * import-deck.mjs
 *
 * One-command import for /decks (出品): uploads a self-contained HTML deck —
 * a single file, or a directory of one (index + N pages, e.g. a 7-day course) —
 * to Cloudflare R2, then upserts its metadata into the ai_pulse_decks table.
 * No git commit or deploy needed; the new deck appears on /decks on next request.
 *
 * The stored href is a same-origin path (`/decks/<slug>/<entry>`), not the raw
 * R2 URL — next.config.ts rewrites `/decks/:slug/:path*` to R2 server-side, so
 * the R2 bucket domain never appears in the visitor's address bar.
 *
 * Usage:
 *   node scripts/import-deck.mjs <html-file-or-dir> \
 *     --slug=<slug> --title="..." --kicker=<KEYNOTE|COURSE|REPORT|PLAYBOOK> --description="..." \
 *     --meta="..." --date=2026-08-12 \
 *     [--entry=index.html] [--status=draft] [--price=19.9] [--currency=CNY] [--dry-run]
 *
 * `--price` is in whole currency units (e.g. `--price=19.9` for ¥19.90), converted to
 * `price_cents` on write. Omit it entirely to leave pricing untouched — on a brand new
 * slug that means the deck stays free (price_cents defaults to NULL); on a re-import of
 * an existing slug it means whatever price was set before is left alone, so refreshing
 * a deck's content never silently un-prices it. Pass `--price=0` to explicitly clear a
 * price and make a deck free again. See TODO.md 阶段 4.2 / `src/lib/decks/access.ts`.
 *
 * `--entry` only matters when the input is a directory: it names the file
 * (relative to that directory) that becomes the deck's link target. Defaults
 * to index.html. All other files in the directory are uploaded alongside it
 * under the same R2 prefix, preserving relative paths, so relative links
 * between pages (e.g. day-01.html -> day-02.html) and relative asset refs
 * (e.g. assets/foo.png) keep working.
 *
 * Objects are served `immutable`; the entry file's stored href carries a
 * `?v=` cache-buster that changes on every run, so re-importing the same
 * slug reliably serves fresh content even though other files in the tree
 * are cached indefinitely at their un-busted URLs.
 *
 * Requires CLOUDFLARE_R2_* and (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * in .env.local.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const MAX_FILE_SIZE = 15 * 1024 * 1024
const KICKERS = ['KEYNOTE', 'COURSE', 'REPORT', 'PLAYBOOK']

async function main() {
  const args = process.argv.slice(2)
  const inputPath = args.find((a) => !a.startsWith('--'))
  const flags = parseFlags(args)
  const dryRun = args.includes('--dry-run')

  if (!inputPath || !flags.slug || !flags.title || !flags.kicker || !flags.description || !flags.meta || !flags.date) {
    console.error(
      'Usage: node scripts/import-deck.mjs <html-file-or-dir> --slug=<slug> --title="..." --kicker=<KEYNOTE|COURSE|REPORT|PLAYBOOK> --description="..." --meta="..." --date=2026-08-12 [--entry=index.html] [--status=draft] [--price=19.9] [--currency=CNY] [--dry-run]'
    )
    process.exit(1)
  }

  flags.kicker = flags.kicker.toUpperCase()
  if (!KICKERS.includes(flags.kicker)) {
    console.error(`--kicker must be one of: ${KICKERS.join(', ')}`)
    process.exit(1)
  }

  if (!/^[a-z0-9-]+$/.test(flags.slug)) {
    console.error('Slug must be lowercase alphanumeric with hyphens.')
    process.exit(1)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(flags.date)) {
    console.error('--date must be in YYYY-MM-DD format.')
    process.exit(1)
  }

  const status = flags.status ?? 'published'
  if (status !== 'draft' && status !== 'published') {
    console.error('--status must be "draft" or "published".')
    process.exit(1)
  }

  let priceCents
  if (flags.price !== undefined) {
    const priceUnits = Number(flags.price)
    if (!Number.isFinite(priceUnits) || priceUnits < 0) {
      console.error('--price must be a non-negative number, e.g. --price=19.9. Use --price=0 to make a deck free again.')
      process.exit(1)
    }
    priceCents = priceUnits === 0 ? null : Math.round(priceUnits * 100)
  }

  const absPath = path.resolve(process.cwd(), inputPath)
  const stat = fs.statSync(absPath)
  const isDirectory = stat.isDirectory()
  const entryRelPath = flags.entry ?? 'index.html'

  const files = isDirectory ? collectFiles(absPath) : [{ abs: absPath, rel: path.basename(absPath) }]
  if (files.length === 0) {
    console.error(`No files found under ${inputPath}`)
    process.exit(1)
  }

  const entryRel = isDirectory ? entryRelPath : files[0].rel
  if (!files.some((f) => f.rel === entryRel)) {
    console.error(`Entry file "${entryRel}" not found under ${inputPath}`)
    process.exit(1)
  }

  for (const file of files) {
    const size = fs.statSync(file.abs).size
    if (size > MAX_FILE_SIZE) {
      console.error(`${file.rel} exceeds ${MAX_FILE_SIZE / 1048576}MB (${(size / 1048576).toFixed(1)}MB)`)
      process.exit(1)
    }
  }

  const payload = {
    slug: flags.slug,
    title: flags.title,
    kicker: flags.kicker,
    description: flags.description,
    meta: flags.meta,
    date: flags.date,
    status,
    // Omitted entirely (rather than sent as undefined/null) when the flag wasn't
    // passed, so re-importing a deck's content never overwrites a price set earlier —
    // see the --price doc comment above.
    ...(priceCents !== undefined ? { price_cents: priceCents } : {}),
    ...(flags.currency ? { currency: flags.currency } : {}),
  }

  if (dryRun) {
    console.log('Dry run OK:')
    console.log(JSON.stringify({ ...payload, files: files.map((f) => f.rel), entry: entryRel }, null, 2))
    return
  }

  const env = loadEnv()
  const { CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL } = env
  if (!CLOUDFLARE_R2_ENDPOINT || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY || !CLOUDFLARE_R2_BUCKET_NAME || !CLOUDFLARE_R2_PUBLIC_URL) {
    console.error('Missing CLOUDFLARE_R2_* configuration in .env.local')
    process.exit(1)
  }
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const r2 = new S3Client({
    region: 'auto',
    endpoint: CLOUDFLARE_R2_ENDPOINT,
    credentials: { accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY },
  })

  const prefix = `decks/${flags.slug}`
  for (const file of files) {
    const key = `${prefix}/${file.rel}`
    await r2.send(new PutObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: fs.readFileSync(file.abs),
      ContentType: CONTENT_TYPES[path.extname(file.rel).toLowerCase()] ?? 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }))
    console.error(`OK: uploaded -> ${key}`)
  }

  const cacheBust = Date.now().toString(36)
  const href = `/${prefix}/${entryRel}?v=${cacheBust}`

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await supabase
    .from('ai_pulse_decks')
    .upsert({ ...payload, href }, { onConflict: 'slug' })

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)

  console.log(`\nOK: /decks entry "${flags.slug}" (${status}) -> ${href}`)
}

function parseFlags(args) {
  const flags = {}
  for (const arg of args) {
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq === -1) continue
    flags[arg.slice(2, eq)] = arg.slice(eq + 1)
  }
  return flags
}

function collectFiles(dirAbs) {
  const results = []
  const walk = (currentAbs, currentRel) => {
    for (const entry of fs.readdirSync(currentAbs, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const entryAbs = path.join(currentAbs, entry.name)
      const entryRel = currentRel ? `${currentRel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(entryAbs, entryRel)
      } else if (entry.isFile()) {
        results.push({ abs: entryAbs, rel: entryRel })
      }
    }
  }
  walk(dirAbs, '')
  return results
}

function loadEnv() {
  const merged = { ...process.env }
  for (const envFile of ['.env.local', '.env']) {
    try {
      const content = fs.readFileSync(envFile, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && !merged[m[1]]) merged[m[1]] = m[2]
      }
    } catch { /* missing env file is fine */ }
  }
  return merged
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
