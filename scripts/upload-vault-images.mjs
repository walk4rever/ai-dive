#!/usr/bin/env node
/**
 * upload-vault-images.mjs
 *
 * Batch-upload Obsidian wiki-style image embeds (![[file.png]]) referenced in a
 * Vault markdown file to Cloudflare R2, then rewrite the embeds in-place to
 * standard markdown image syntax with the returned public URLs.
 *
 * Usage:
 *   node scripts/upload-vault-images.mjs <markdown-file> <assets-dir> [r2-folder]
 *
 * Example:
 *   node scripts/upload-vault-images.mjs \
 *     "/Users/rafael/R129/Vault/Situational Awareness/I. From GPT-4 to AGI (Chinese).md" \
 *     "/Users/rafael/R129/Vault/Insights/assets/situational-awareness" \
 *     "posts/situational-awareness"
 *
 * Keys are deterministic (`<r2-folder>/<filename>`), so re-runs are idempotent.
 * Requires CLOUDFLARE_R2_* vars in .env.local.
 */
import fs from 'node:fs'
import path from 'node:path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { lookup } from 'mime-types'

const [, , mdPath, assetsDir, folder = 'posts/vault'] = process.argv
if (!mdPath || !assetsDir) {
  console.error('Usage: node scripts/upload-vault-images.mjs <markdown-file> <assets-dir> [r2-folder]')
  process.exit(1)
}

// --- load .env.local (same convention as import-post.mjs) ---
for (const envFile of ['.env.local', '.env']) {
  try {
    const content = fs.readFileSync(envFile, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch { /* missing env file is fine */ }
}

const { CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL } = process.env
if (!CLOUDFLARE_R2_ENDPOINT || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY || !CLOUDFLARE_R2_BUCKET_NAME || !CLOUDFLARE_R2_PUBLIC_URL) {
  console.error('Missing CLOUDFLARE_R2_* configuration in .env.local')
  process.exit(1)
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: CLOUDFLARE_R2_ENDPOINT,
  credentials: { accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY },
})

const MAX_SIZE = 20 * 1024 * 1024

let md = fs.readFileSync(mdPath, 'utf8')
const embeds = [...new Set([...md.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(m => m[1]))]
if (embeds.length === 0) {
  console.log('No ![[...]] embeds found; nothing to do.')
  process.exit(0)
}

console.log(`Found ${embeds.length} unique embeds.`)
const urlByName = new Map()

for (const name of embeds) {
  const filePath = path.join(assetsDir, name)
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${name} (not found in ${assetsDir})`)
    continue
  }
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_SIZE) {
    console.error(`SKIP: ${name} exceeds 20MB (${(stat.size / 1048576).toFixed(1)}MB)`)
    continue
  }
  const key = `${folder}/${name}`
  const contentType = lookup(name) || 'application/octet-stream'
  await r2.send(new PutObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: fs.readFileSync(filePath),
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  const url = `${CLOUDFLARE_R2_PUBLIC_URL}/${key}`
  urlByName.set(name, url)
  console.log(`OK: ${name} -> ${url}`)
}

// --- rewrite embeds in the markdown file ---
let rewritten = 0
md = md.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (whole, name) => {
  const url = urlByName.get(name)
  if (!url) return whole
  rewritten++
  return `![](${url})`
})
fs.writeFileSync(mdPath, md)
console.log(`Rewrote ${rewritten} embeds in ${path.basename(mdPath)}.`)
