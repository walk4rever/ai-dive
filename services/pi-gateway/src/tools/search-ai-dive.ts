import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { pool } from "../db.js";

type StoryRow = {
  slug: string;
  title: string;
  excerpt: string;
  content_type: string;
  published_at: string | null;
  rank: number;
};

// websearch_to_tsquery('english', ...) doesn't segment CJK text and requires every
// term to match (AND), so mixed Chinese/English queries reliably return zero rows.
// Tokenize into CJK/Latin runs and OR-match them with ILIKE instead, ranked by hit count.
function tokenize(query: string): string[] {
  const spaced = query
    .replace(/([一-鿿])([a-zA-Z0-9])/g, "$1 $2")
    .replace(/([a-zA-Z0-9])([一-鿿])/g, "$1 $2");
  const terms = spaced
    .split(/[\s,，。！？、；;:："“”‘’()（）\[\]【】·]+/)
    .map((t) => t.trim().replace(/[%_\\]/g, (c) => `\\${c}`))
    .filter((t) => t.length > 0);
  return [...new Set(terms)];
}

async function fullTextSearch(query: string, contentType: string | null, limit: number): Promise<StoryRow[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const result = await pool.query<StoryRow>(
    `
    WITH terms AS (SELECT unnest($1::text[]) AS term)
    SELECT
      s.slug,
      s.title,
      s.excerpt,
      s.content_type,
      to_char(s.published_at, 'YYYY-MM-DD') AS published_at,
      (
        SELECT count(*)::int FROM terms t
        WHERE s.title ILIKE '%' || t.term || '%' ESCAPE '\\'
           OR s.excerpt ILIKE '%' || t.term || '%' ESCAPE '\\'
           OR s.content ILIKE '%' || t.term || '%' ESCAPE '\\'
      ) AS rank
    FROM ai_pulse_stories s
    WHERE
      s.status = 'published'
      AND ($2::text IS NULL OR s.content_type = $2)
      AND EXISTS (
        SELECT 1 FROM terms t
        WHERE s.title ILIKE '%' || t.term || '%' ESCAPE '\\'
           OR s.excerpt ILIKE '%' || t.term || '%' ESCAPE '\\'
           OR s.content ILIKE '%' || t.term || '%' ESCAPE '\\'
      )
    ORDER BY rank DESC, s.published_at DESC
    LIMIT $3
    `,
    [terms, contentType ?? null, limit],
  );
  return result.rows;
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  intel: "情报",
  tech: "技术",
  case: "案例",
  insight: "洞见",
};

function formatResults(rows: StoryRow[]): string {
  if (rows.length === 0) return "No matching content found in AI-DIVE.";
  return rows
    .map((r) => {
      const label = CONTENT_TYPE_LABEL[r.content_type] ?? r.content_type;
      const date = r.published_at ? r.published_at.slice(0, 10) : "";
      const url = `https://ai-dive.com/${r.content_type}s/${r.slug}`;
      return [`[${label}] ${r.title}`, date ? `Published: ${date}` : "", url, r.excerpt].filter(Boolean).join("\n");
    })
    .join("\n\n---\n\n");
}

export const searchAiDiveTool = defineTool({
  name: "search_ai_dive",
  label: "Search AI-DIVE Content",
  description:
    "Search published AI-DIVE articles (技术 tech analyses, 案例 case studies, 洞见 insights, 情报 intels). Use this to find what AI-DIVE has already covered on a topic, and connect the user's question to existing curated content.",
  promptSnippet: "search_ai_dive(query, content_type?) → matching articles with title, excerpt, and URL",
  parameters: Type.Object({
    query: Type.String({ description: "Search query — keywords or a natural language question" }),
    content_type: Type.Optional(
      Type.String({
        description: "Filter by type: intel | tech | case | insight. Omit to search all types.",
      }),
    ),
  }),
  async execute(_id, params, signal) {
    const { query, content_type } = params;

    if (signal?.aborted) {
      return { content: [{ type: "text" as const, text: "Search cancelled." }], details: null };
    }

    let rows: StoryRow[];
    try {
      rows = await fullTextSearch(query, content_type ?? null, 6);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Search failed: ${msg}` }], details: null };
    }

    return {
      content: [{ type: "text" as const, text: formatResults(rows) }],
      details: { count: rows.length },
    };
  },
});
