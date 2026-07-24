import { markdownToHtml as renderMarkdown } from './markdown-pipeline.mjs'

// Untrusted, network-submitted content (agent API) — always sanitized.
export async function markdownToHtml(markdown: string): Promise<string> {
  return renderMarkdown(markdown, { sanitize: true })
}
