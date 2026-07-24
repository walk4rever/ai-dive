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
  title: string;
  description: string;
  url: string;
  signal_date: string | null;
  rank: number;
};

type ResultItem = {
  label: string;
  title: string;
  excerpt: string;
  date: string;
  url: string;
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

// AI-DIVE's 情报 (intel) content lives in ai_pulse_signals, a separate feed of
// scored external links — not in ai_pulse_stories, which has no 'intel' rows at all.
async function signalSearch(query: string, limit: number): Promise<SignalRow[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const result = await pool.query<SignalRow>(
    `
    WITH terms AS (SELECT unnest($1::text[]) AS term)
    SELECT
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
    SELECT title, description, url, to_char(signal_date, 'YYYY-MM-DD') AS signal_date, 0 AS rank
    FROM ai_pulse_signals
    WHERE status = 'enabled'
    ORDER BY signal_date DESC, insight DESC NULLS LAST
    LIMIT $1
    `,
    [limit],
  );
  return result.rows;
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  intel: "情报",
  dive: "深度",
  insight: "洞见",
};

function storyToResultItem(r: StoryRow): ResultItem {
  return {
    label: CONTENT_TYPE_LABEL[r.content_type] ?? r.content_type,
    title: r.title,
    excerpt: r.excerpt,
    date: r.published_at ? r.published_at.slice(0, 10) : "",
    url: `https://ai.air7.fun/post/${r.slug}`,
    rank: r.rank,
  };
}

function signalToResultItem(r: SignalRow): ResultItem {
  return {
    label: "情报",
    title: r.title,
    excerpt: r.description,
    date: r.signal_date ?? "",
    url: r.url,
    rank: r.rank,
  };
}

function formatResults(items: ResultItem[]): string {
  if (items.length === 0) return "No matching content found in AI-DIVE.";
  return items
    .map((r) => {
      return [`[${r.label}] ${r.title}`, r.date ? `Published: ${r.date}` : "", r.url, r.excerpt]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

export const searchAiDiveTool = defineTool({
  name: "search_ai_dive",
  label: "Search AI-DIVE Content",
  description:
    "Search AI-DIVE content: published articles (深度 dive analyses, 洞见 insights) and the 情报 intel feed (scored daily signals from X/GitHub/arXiv/news). Use this to find what AI-DIVE has already covered on a topic, or what's new in today's intel feed.",
  promptSnippet: "search_ai_dive(query, content_type?) → matching articles/signals with title, excerpt, and URL",
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
