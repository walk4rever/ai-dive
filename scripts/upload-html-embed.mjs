#!/usr/bin/env node
/**
 * upload-html-embed.mjs
 *
 * Uploads a self-contained, agent-generated interactive HTML file (report, demo,
 * visualization) to Cloudflare R2, then prints a ready-to-paste markdown snippet:
 * an `::embed{src=... height=...}` directive (rendered as a sandboxed iframe by
 * markdown-pipeline.mjs) plus a hidden `<!-- ai-context -->` comment containing the
 * file's extracted plain text, so AI-DIVE's article chat (get_article_content) can
 * still answer questions about content that only lives inside the iframe.
 *
 * Before upload, a small resize-reporter script is injected into the HTML. It
 * posts the page's real height to the parent window on load/resize; the parent
 * post page (MermaidContent.tsx) listens for that and resizes the iframe to fit,
 * so the `height` you pass here is only a pre-JS initial guess, not the final
 * word — no more guessing a fixed height and getting a nested scrollbar when
 * you guess short.
 *
 * Usage:
 *   node scripts/upload-html-embed.mjs <html-file> <slug> [--height=2400]
 *
 * Example:
 *   node scripts/upload-html-embed.mjs ./k3-report.html kimi-k3-plain-guide --height=2400
 *
 * Key is deterministic (`posts/<slug>/embed.html`), so re-runs overwrite the same
 * object. The object is served `immutable`, though, so the printed URL carries a
 * `?v=` cache-buster on every run — paste the fresh URL into the article again
 * when you republish, otherwise CDN/browser caches keep serving the old bytes.
 * Requires CLOUDFLARE_R2_* vars in .env.local.
 */
import fs from 'node:fs'
import path from 'node:path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const args = process.argv.slice(2)
const heightArg = args.find((a) => a.startsWith('--height='))
const [, , htmlPath, slug] = process.argv
const height = heightArg ? Number.parseInt(heightArg.split('=')[1], 10) : undefined

if (!htmlPath || !slug) {
  console.error('Usage: node scripts/upload-html-embed.mjs <html-file> <slug> [--height=2400]')
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

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error('Slug must be lowercase alphanumeric with hyphens.')
  process.exit(1)
}

const MAX_SIZE = 15 * 1024 * 1024

const absPath = path.resolve(process.cwd(), htmlPath)
const stat = fs.statSync(absPath)
if (stat.size > MAX_SIZE) {
  console.error(`${htmlPath} exceeds ${MAX_SIZE / 1048576}MB (${(stat.size / 1048576).toFixed(1)}MB)`)
  process.exit(1)
}

const html = fs.readFileSync(absPath, 'utf8')
const htmlToUpload = injectResizeReporter(html)

const r2 = new S3Client({
  region: 'auto',
  endpoint: CLOUDFLARE_R2_ENDPOINT,
  credentials: { accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY },
})

const key = `posts/${slug}/embed.html`
await r2.send(new PutObjectCommand({
  Bucket: CLOUDFLARE_R2_BUCKET_NAME,
  Key: key,
  Body: htmlToUpload,
  ContentType: 'text/html; charset=utf-8',
  CacheControl: 'public, max-age=31536000, immutable',
}))
const cacheBust = Date.now().toString(36)
const url = `${CLOUDFLARE_R2_PUBLIC_URL}/${key}?v=${cacheBust}`
console.error(`OK: uploaded -> ${url}`)

const aiContext = extractReadableText(html)

const snippet = [
  `::embed{src="${url}"${height ? ` height="${height}"` : ''}}`,
  '',
  '<!-- ai-context:',
  aiContext,
  '-->',
].join('\n')

console.log('\n--- paste into the article markdown ---\n')
console.log(snippet)

function injectResizeReporter(rawHtml) {
  const script = `<script>
(function () {
  function reportHeight() {
    var height = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'ai-dive-embed-resize', height: height }, '*');
  }
  window.addEventListener('load', reportHeight);
  if (window.ResizeObserver) {
    new ResizeObserver(reportHeight).observe(document.documentElement);
  } else {
    window.addEventListener('resize', reportHeight);
    setInterval(reportHeight, 1000);
  }
})();
</script>`

  if (/<\/body>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/body>/i, `${script}\n</body>`)
  }
  return `${rawHtml}\n${script}`
}

function extractReadableText(rawHtml) {
  const withoutScripts = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ')
  const decoded = withoutTags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
  return decoded.replace(/\s{2,}/g, ' ').trim().slice(0, 8000)
}
