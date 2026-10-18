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

type SignalRow = {
  id: string;
  title: string;
  description: string;
  url: string;
  signal_date: string | null;
  rank: number;
};

type ResultItem = {
  kind: "dive" | "insight" | "intel";
  ref: string;
  title: string;
  excerpt: string;
  date: string;
  aiDiveUrl: string;
  sourceUrl?: string;
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
      AND s.is_premium = false
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

// AI-DIVE's 情报 (intel) content lives in ai_pulse_signals, a separate daily feed
// of external links — not in ai_pulse_stories, which has no 'intel' rows at all.
async function signalSearch(query: string, limit: number): Promise<SignalRow[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const result = await pool.query<SignalRow>(
    `
    WITH terms AS (SELECT unnest($1::text[]) AS term)
    SELECT
      s.id,
      s.title,
      s.description,
      s.url,
      to_char(s.signal_date, 'YYYY-MM-DD') AS signal_date,
      (
        SELECT count(*)::int FROM terms t
        WHERE s.title ILIKE '%' || t.term || '%' ESCAPE '\\'
           OR s.description ILIKE '%' || t.term || '%' ESCAPE '\\'
      ) AS rank
    FROM ai_pulse_signals s
    WHERE
      s.status = 'enabled'
      AND EXISTS (
        SELECT 1 FROM terms t
        WHERE s.title ILIKE '%' || t.term || '%' ESCAPE '\\'
           OR s.description ILIKE '%' || t.term || '%' ESCAPE '\\'
      )
    ORDER BY rank DESC, s.signal_date DESC
    LIMIT $2
    `,
    [terms, limit],
  );
  return result.rows;
}

async function recentSignals(limit: number): Promise<SignalRow[]> {
  const result = await pool.query<SignalRow>(
    `
    SELECT id, title, description, url, to_char(signal_date, 'YYYY-MM-DD') AS signal_date, 0 AS rank
    FROM ai_pulse_signals
    WHERE status = 'enabled'
    ORDER BY signal_date DESC, created_at DESC
    LIMIT $1
    `,
    [limit],
  );
  return result.rows;
}

function storyToResultItem(r: StoryRow): ResultItem {
  return {
    kind: r.content_type === "insight" ? "insight" : "dive",
    ref: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    date: r.published_at ? r.published_at.slice(0, 10) : "",
    aiDiveUrl: `https://ai.air7.fun/post/${r.slug}`,
    rank: r.rank,
  };
}

function signalToResultItem(r: SignalRow): ResultItem {
  return {
    kind: "intel",
    ref: r.id,
    title: r.title,
    excerpt: r.description,
    date: r.signal_date ?? "",
    aiDiveUrl: r.signal_date ? `https://ai.air7.fun/intels/${r.signal_date}#signal-${r.id}` : `https://ai.air7.fun/intels`,
    sourceUrl: r.url,
    rank: r.rank,
  };
}

function formatResults(items: ResultItem[]): string {
  if (items.length === 0) return "No matching content found in AI-DIVE.";
  return items
    .map((r) => {
      const meta = [
        `[${r.kind}] ${r.title}`,
        r.date ? `Date: ${r.date}` : "",
        `Ref: ${r.ref}`,
        `AI-DIVE: ${r.aiDiveUrl}`,
        r.sourceUrl ? `Source: ${r.sourceUrl}` : "",
      ].filter(Boolean).join("\n");
      return `${meta}\n\n${r.excerpt}`;
    })
    .join("\n\n---\n\n");
}

export const searchAiDiveTool = defineTool({
  name: "search_ai_dive",
  label: "Search AI-DIVE Content",
  description:
    "Search AI-DIVE's own content: published free dive and insight articles, plus the intel signal feed. Returns each result's type, date, ref (article slug or intel signal id), AI-DIVE URL, original source URL for intel, and summary. Use this first for any topic question to find what AI-DIVE has covered. Do not use it for public web search.",
  promptSnippet:
    "search_ai_dive(query, content_type?) → matching dive/insight/intel items with type, ref, AI-DIVE URL, summary",
  parameters: Type.Object({
    query: Type.String({ description: "Search query — keywords or a natural language question" }),
    content_type: Type.Optional(
      Type.String({
        description: "Filter by type: intel | dive | insight. Omit to search all types.",
      }),
    ),
  }),
  async execute(_id, params, signal) {
    const { query, content_type } = params;
    const limit = 6;

    if (signal?.aborted) {
      return { content: [{ type: "text" as const, text: "Search cancelled." }], details: null };
    }

    let items: ResultItem[];
    try {
      if (content_type === "intel") {
        // Natural-language "what's new today" questions often glue into one long
        // CJK token that matches nothing literally — fall back to latest signals.
        const signals = await signalSearch(query, limit);
        items = (signals.length > 0 ? signals : await recentSignals(limit)).map(signalToResultItem);
      } else if (content_type) {
        items = (await fullTextSearch(query, content_type, limit)).map(storyToResultItem);
      } else {
        const [stories, signals] = await Promise.all([
          fullTextSearch(query, null, limit),
          signalSearch(query, limit),
        ]);
        items = [...stories.map(storyToResultItem), ...signals.map(signalToResultItem)]
          .sort((a, b) => b.rank - a.rank || b.date.localeCompare(a.date))
          .slice(0, limit);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Search failed: ${msg}` }], details: null };
    }

    return {
      content: [{ type: "text" as const, text: formatResults(items) }],
      details: { count: items.length },
    };
  },
});
