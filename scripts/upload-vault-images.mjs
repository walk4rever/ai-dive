#!/usr/bin/env node
/**
 * upload-vault-images.mjs
 *
 * Batch-upload local assets referenced in a Vault markdown file to Cloudflare R2,
 * then rewrite the references in-place with the returned public URLs. Handles both
 * Obsidian wiki embeds (`![[file.png]]`) and standard markdown images that point at
 * the given assets dir (`![alt](assets/file.png)`). Video files (mp4/webm/mov) are
 * rewritten to an HTML `<video>` tag instead of `![]()` — an `<img>` pointing at a
 * video URL will not play.
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

const MAX_SIZE = 60 * 1024 * 1024

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov'])
const isVideo = (name) => VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase())

let md = fs.readFileSync(mdPath, 'utf8')

// Wiki embeds may include a leading path (e.g. `![[assets/file.mp4]]`); normalize to the
// bare filename since that's what actually lives under assetsDir.
const wikiEmbeds = [...md.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => path.basename(m[1]))
const standardEmbeds = [...md.matchAll(/!\[[^\]]*\]\(assets\/([^)\s]+)\)/g)].map((m) => path.basename(m[1]))
const embeds = [...new Set([...wikiEmbeds, ...standardEmbeds])]

if (embeds.length === 0) {
  console.log('No local asset references found; nothing to do.')
  process.exit(0)
}

console.log(`Found ${embeds.length} unique asset references.`)
const urlByName = new Map()

for (const name of embeds) {
  const filePath = path.join(assetsDir, name)
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${name} (not found in ${assetsDir})`)
    continue
  }
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_SIZE) {
    console.error(`SKIP: ${name} exceeds ${MAX_SIZE / 1048576}MB (${(stat.size / 1048576).toFixed(1)}MB)`)
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

const replacement = (rawName, alt = '') => {
  const name = path.basename(rawName)
  const url = urlByName.get(name)
  if (!url) return null
  rewritten++
  return isVideo(name)
    ? `<video controls style="width:100%" src="${url}"></video>`
    : `![${alt}](${url})`
}

md = md.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (whole, name) => replacement(name) ?? whole)
md = md.replace(/!\[([^\]]*)\]\(assets\/([^)\s]+)\)/g, (whole, alt, name) => replacement(name, alt) ?? whole)

fs.writeFileSync(mdPath, md)
console.log(`Rewrote ${rewritten} references in ${path.basename(mdPath)}.`)
