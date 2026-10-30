#!/usr/bin/env node

/**
 * Batch import for Vault markdown files.
 *
 * Fallback classification (used only when frontmatter lacks a "type" field):
 *   wechat-daily-*  → type: daily,   author: dwight
 *   weekly-* / 周刊  → type: weekly,  author: monica
 *   everything else → type: series,  author: rafa
 *
 * Usage:
 *   node scripts/import-batch.mjs "/path/to/file1.md" "/path/to/file2.md"
 *   node scripts/import-batch.mjs --dry-run "/path/glob/*.md"
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filePaths = args.filter((a) => !a.startsWith('--'))

  if (!filePaths.length) {
    console.error('Usage: node scripts/import-batch.mjs [--dry-run] file1.md file2.md ...')
    process.exit(1)
  }

  let ok = 0
  let fail = 0

  for (const filePath of filePaths) {
    const abs = path.resolve(filePath)
    try {
      const tmpPath = await prepareWithFrontmatter(abs)
      const cmdArgs = ['run', 'import:post', '--']
      if (dryRun) cmdArgs.push('--dry-run')
      cmdArgs.push(tmpPath)

      execFileSync('npm', cmdArgs, { cwd: path.resolve(import.meta.dirname, '..'), stdio: 'inherit' })
      await fs.unlink(tmpPath).catch(() => {})
      ok++
    } catch (err) {
      console.error(`\n✗ ${path.basename(filePath)}: ${err.message ?? err}`)
      fail++
    }
  }

  console.log(`\nDone: ${ok} imported, ${fail} failed.`)
}

async function prepareWithFrontmatter(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  const basename = path.basename(filePath, '.md')
  const { contentType, authorSlug } = classifyFile(basename)

  let existingFm = {}
  let body = raw

  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (fmMatch) {
    // Parse existing frontmatter key-value pairs (simple)
    for (const line of fmMatch[1].split('\n')) {
      const sep = line.indexOf(':')
      if (sep === -1) continue
      const k = line.slice(0, sep).trim()
      const v = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '')
      if (k) existingFm[k] = v
    }
    body = fmMatch[2].trim()
  }

  const title = existingFm.title || extractTitle(raw) || basename
  const slug = existingFm.slug || basename
  const date = existingFm.date || extractDate(basename)
  const excerpt = existingFm.excerpt || existingFm.description || deriveExcerpt(body)
  const status = existingFm.status || 'published'
  const resolvedType = existingFm.type || contentType
  const resolvedSource = existingFm.source || authorSlug
  const series = existingFm.series || null

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `slug: "${slug}"`,
    `type: ${resolvedType}`,
    `source: ${resolvedSource}`,
    `status: ${status}`,
    date ? `date: "${date}"` : '',
    series ? `series: ${series}` : '',
    `excerpt: "${excerpt.replace(/"/g, '\\"')}"`,
    '---',
  ].filter(Boolean).join('\n')

  // Strip leading H1 from body if present
  const cleanBody = body.replace(/^#[^\n]*\n/, '').trim()
  const tmp = path.join(os.tmpdir(), `aip-${basename}.md`)
  await fs.writeFile(tmp, `${frontmatter}\n\n${cleanBody}`, 'utf8')
  return tmp
}

function classifyFile(basename) {
  if (basename.startsWith('wechat')) return { contentType: 'daily', authorSlug: 'dwight' }
  if (basename.startsWith('weekly') || basename.includes('周刊')) return { contentType: 'weekly', authorSlug: 'monica' }
  return { contentType: 'series', authorSlug: 'rafa' }
}

function extractTitle(raw) {
  const m = raw.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : ''
}

function extractDate(basename) {
  // yyyy-mm-dd
  const m1 = basename.match(/(\d{4}-\d{2}-\d{2})/)
  if (m1) return m1[1]
  // yyyymmdd (take first 8-digit run as start date)
  const m2 = basename.match(/(\d{4})(\d{2})(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  return null
}

function deriveExcerpt(raw) {
  const plain = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, 160).trim()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
