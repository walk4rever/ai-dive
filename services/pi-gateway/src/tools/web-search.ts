import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { deepseekToolRequest } from "./deepseek.js";

interface SearchResult {
  rerank_score: number;
  title: string;
  url: string;
  snippet: string;
  summary: string;
  content: string;
  site_name: string | null;
  date: string | null;
  authority: number;
}

interface SearchResponse {
  results: SearchResult[];
}

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;
const MAX_CONTENT_RESULTS = 3;
const MAX_CONTENT_CHARS = 4000;

function clampCount(value: number | undefined, includeContent: boolean): number {
  const requested = typeof value === "number" && Number.isFinite(value)
    ? Math.floor(value)
    : DEFAULT_COUNT;
  const cap = includeContent ? MAX_CONTENT_RESULTS : MAX_COUNT;
  return Math.max(1, Math.min(cap, requested));
}

function formatMeta(result: SearchResult): string {
  const parts = [
    result.site_name,
    result.date ? result.date.slice(0, 10) : "",
    Number.isFinite(result.rerank_score) ? `score ${result.rerank_score.toFixed(2)}` : "",
    Number.isFinite(result.authority) ? `authority ${result.authority}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

function formatResults(results: SearchResult[], includeContent: boolean): string {
  return results
    .map((result, index) => {
      const lines = [
        `${index + 1}. ${result.title}`,
        `URL: ${result.url}`,
        formatMeta(result),
        result.summary || result.snippet,
      ];

      if (includeContent && result.content) {
        const content = result.content.length > MAX_CONTENT_CHARS
          ? `${result.content.slice(0, MAX_CONTENT_CHARS)}\n[content truncated]`
          : result.content;
        lines.push("", content);
      }

      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n---\n\n");
}

export const webSearchTool = defineTool({
  name: "web_search",
  label: "Search the Web",
  description:
    "Search the public web through DeepSeek. Use for recent releases, news, current facts, and claims that AI-DIVE's own content does not cover. Supports search operators such as site:, -site:, \"exact phrase\", lang:, after:, and before:. Returns ranked results with title, URL, date, site, score, authority, and summary. Do not use this for AI-DIVE content (use search_ai_dive), arXiv papers (use analyze_arxiv), or GitHub repositories (use analyze_github).",
  promptSnippet:
    "web_search(query, count?, include_content?) → ranked public web results with title, URL, date, and summary",
  parameters: Type.Object({
    query: Type.String({
      description:
        "Search query, 1-128 characters. May include site:, -site:, \"exact phrase\", lang:, after:, or before:.",
    }),
    count: Type.Optional(
      Type.Number({
        description: `Number of results to return, 1-${MAX_COUNT}. Default ${DEFAULT_COUNT}.`,
      }),
    ),
    include_content: Type.Optional(
      Type.Boolean({
        description:
          "Include page text for up to 3 results. Default false; prefer fetch_web_page for the URL you actually need.",
      }),
    ),
  }),
  async execute(_id, params, signal) {
    const query = params.query.trim();
    if (!query || query.length > 128) {
      return {
        content: [{ type: "text" as const, text: "Search query must be 1-128 characters." }],
        details: null,
      };
    }

    const includeContent = params.include_content === true;
    const count = clampCount(params.count, includeContent);

    try {
      const data = await deepseekToolRequest<SearchResponse>(
        "/v1/tools/search",
        { query, count, need_content: includeContent },
        { signal, timeoutMs: 20000 },
      );

      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No web results found for "${query}". Try a broader query.` }],
          details: { query, count: 0 },
        };
      }

      return {
        content: [{ type: "text" as const, text: formatResults(results, includeContent) }],
        details: { query, count: results.length },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        details: null,
      };
    }
  },
});
