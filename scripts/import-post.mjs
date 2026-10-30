#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import yaml from 'js-yaml'
import { markdownToHtml as renderMarkdown } from '../src/lib/markdown-pipeline.mjs'

// Trusted, locally-authored content (Vault CLI import) — no sanitization.
const markdownToHtml = (markdown) => renderMarkdown(markdown, { sanitize: false })

const VALID_CONTENT_TYPES = new Set(['intel', 'dive'])
const VALID_STATUS = new Set(['draft', 'published'])

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const inputPath = args.find((arg) => !arg.startsWith('--'))

  if (!inputPath) {
    console.error('Usage: npm run import:post -- [--dry-run] "/absolute/or/relative/path/to/article.md"')
    process.exit(1)
  }

  // Loaded before rendering (not just before the Supabase write) because
  // markdownToHtml's embed-directive handling reads CLOUDFLARE_R2_PUBLIC_URL
  // from process.env to validate `::embed{src=...}` hosts.
  const env = await loadEnv()

  const articlePath = path.resolve(process.cwd(), inputPath)
  const raw = await fs.readFile(articlePath, 'utf8')
  const { data, body } = parseFrontmatter(raw)
  const normalized = normalizePost({ filePath: articlePath, data, body })

  const payload = {
    slug: normalized.slug,
    title: normalized.title,
    content: await markdownToHtml(normalized.body),
    body_markdown: normalized.body,
    excerpt: normalized.excerpt,
    is_premium: normalized.isPremium,
    status: normalized.status,
    content_type: normalized.contentType,
    featured: normalized.featured,
    source: normalized.source,
    author: normalized.postAuthor,
    source_url: normalized.sourceUrl,
    published_at: normalized.publishedAt,
  }

  if (dryRun) {
    console.log('Dry run OK:')
    console.log(JSON.stringify({
      title: payload.title,
      slug: payload.slug,
      content_type: payload.content_type,
      status: payload.status,
      featured: payload.featured,
      source: payload.source,
      author: payload.author,
      source_url: payload.source_url,
      published_at: payload.published_at,
      excerpt: payload.excerpt,
    }, null, 2))
    return
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!isValidHttpUrl(url) || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or shell.'
    )
  }

  const supabase = createClient(url, serviceRoleKey)
  const { error } = await supabase
    .from('ai_pulse_stories')
    .upsert(payload, { onConflict: 'slug' })

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`)
  }

  console.log('Imported post successfully:')
  console.log(`- title: ${normalized.title}`)
  console.log(`- slug: ${normalized.slug}`)
  console.log(`- type: ${normalized.contentType}`)
  console.log(`- status: ${normalized.status}`)
  console.log(`- featured: ${normalized.featured}`)
  console.log(`- source: ${normalized.source}`)

}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)

  if (!match) {
    throw new Error('Missing YAML frontmatter block.')
  }

  const [, frontmatterRaw, body] = match
  const data = yaml.load(frontmatterRaw) ?? {}

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Frontmatter must be a YAML object.')
  }

  return { data, body: body.trim() }
}

async function loadEnv() {
  const merged = { ...process.env }
  const files = ['.env.local', '.env']

  for (const fileName of files) {
    const filePath = path.resolve(process.cwd(), fileName)
    try {
      const content = await fs.readFile(filePath, 'utf8')
      Object.assign(merged, parseEnvFile(content))
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  // Mirror into process.env too — markdownToHtml() (and its embed-directive
  // host check) reads process.env directly, not this function's return value.
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = value
  }

  return merged
}

function parseEnvFile(content) {
  const env = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

function normalizePost({ filePath, data, body }) {
  const title = asNonEmptyString(data.title)
  if (!title) {
    throw new Error('Frontmatter field "title" is required.')
  }

  let contentType = asNonEmptyString(data.type)
  if (contentType === 'insight') {
    contentType = 'dive'
  }
  if (!VALID_CONTENT_TYPES.has(contentType)) {
    throw new Error('Frontmatter field "type" must be intel or dive.')
  }

  const status = asNonEmptyString(data.status) || 'draft'
  if (!VALID_STATUS.has(status)) {
    throw new Error('Frontmatter field "status" must be draft or published.')
  }

  const slug = asNonEmptyString(data.slug) || slugify(title)
  if (!slug) {
    throw new Error('Unable to derive slug from title. Add frontmatter field "slug".')
  }

  const publishedAt = normalizeDate(data.date)
  const excerpt = asNonEmptyString(data.excerpt) || deriveExcerpt(body)

  // 2026-10-30 规范（Vault/FRONTMATTER.md）：source=来源名、author=真实署名作者、
  // source_url=原文地址。旧格式构建文件兼容：source 是 URL 时，来源名取 author 字段。
  const rawSource = asNonEmptyString(data.source)
  const legacySourceIsUrl = /^https?:\/\//.test(rawSource)
  const source = legacySourceIsUrl
    ? toAuthorDisplay(data.author) || 'R129'
    : rawSource || toAuthorDisplay(data.author) || 'R129'
  const postAuthor = legacySourceIsUrl ? null : asNonEmptyString(data.author) || null
  const sourceUrl = asNonEmptyString(data.source_url) || (legacySourceIsUrl ? rawSource : '') || null

  return {
    title,
    slug,
    body,
    excerpt,
    isPremium: Boolean(data.is_premium),
    status,
    contentType,
    featured: Boolean(data.featured),
    source,
    postAuthor,
    sourceUrl,
    publishedAt,
    filePath,
  }
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  if (typeof value === 'number') {
    const parsedFromNumber = new Date(value)
    if (!Number.isNaN(parsedFromNumber.getTime())) {
      return parsedFromNumber.toISOString()
    }
  }

  const raw = asNonEmptyString(value)
  if (!raw) {
    return new Date().toISOString()
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid frontmatter date: ${raw}`)
  }

  return parsed.toISOString()
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function stripWikilinks(value) {
  const raw = asNonEmptyString(value)
  if (!raw) return ''
  return raw
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/[\[\]]/g, '')
    .trim()
}

function toAuthorDisplay(value) {
  const raw = stripWikilinks(value)
  if (!raw) return null
  if (/^x@/i.test(raw)) return raw
  const key = raw.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
  const overrides = {
    '20vc': '20VC',
    'twiml ai': 'TWIML AI',
    'ai dive': 'AI-DIVE',
    'the a16z show': 'The a16z Show',
    'rafa': 'RAFA',
    'r129': 'R129',
  }
  if (overrides[key]) return overrides[key]
  return raw.replace(/[-_]+/g, ' ').split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function deriveExcerpt(markdown) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return plain.slice(0, 180).trim()
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
}


function isValidHttpUrl(value) {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
