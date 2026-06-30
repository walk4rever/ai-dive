import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

function extractArxivId(input: string): string | null {
  // Handles: full URL, abs URL, pdf URL, or bare ID like "2502.09601"
  const patterns = [
    /arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i,
    /^(\d{4}\.\d{4,5}(?:v\d+)?)$/,
  ];
  for (const re of patterns) {
    const m = input.trim().match(re);
    if (m) return m[1];
  }
  return null;
}

async function fetchAbstract(id: string): Promise<string> {
  const res = await fetch(`https://arxiv.org/abs/${id}`, {
    headers: { "User-Agent": "ai-dive-agent/1.0 (research tool)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`arxiv returned ${res.status}`);
  const html = await res.text();

  const title = html.match(/<h1 class="title[^"]*">\s*<span[^>]*>.*?<\/span>\s*([\s\S]*?)<\/h1>/)?.[1]?.trim()
    ?? html.match(/<title>(.*?)\s*\|/)?.[1]?.trim()
    ?? "Unknown title";

  const authors = html.match(/<div class="authors">([\s\S]*?)<\/div>/)?.[1]
    ?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";

  const abstract = html.match(/<blockquote class="abstract[^"]*">\s*<span[^>]*>.*?<\/span>([\s\S]*?)<\/blockquote>/)?.[1]
    ?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";

  const submitted = html.match(/Submitted on ([\s\S]*?)</)?.[1]?.trim() ?? "";

  return [
    `**${title}**`,
    authors ? `Authors: ${authors}` : "",
    submitted ? `Submitted: ${submitted}` : "",
    "",
    "**Abstract:**",
    abstract,
    "",
    `arxiv: https://arxiv.org/abs/${id}`,
    `HTML full paper: https://arxiv.org/html/${id}`,
    `PDF: https://arxiv.org/pdf/${id}`,
  ].filter(l => l !== undefined).join("\n");
}

async function fetchFullPaper(id: string): Promise<string | null> {
  // Try the HTML version — available for papers since ~2023
  try {
    const res = await fetch(`https://arxiv.org/html/${id}`, {
      headers: { "User-Agent": "ai-dive-agent/1.0 (research tool)" },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract main article body, strip tags, truncate
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    return body.length > 12000 ? body.slice(0, 12000) + "\n\n[truncated — paper continues]" : body;
  } catch {
    return null;
  }
}

export const analyzeArxivTool = defineTool({
  name: "analyze_arxiv",
  label: "Analyze arXiv Paper",
  description:
    "Fetch and analyze an arXiv paper. Accepts an arXiv URL (arxiv.org/abs/...) or bare paper ID (e.g. 2502.09601). Returns title, authors, abstract, and full paper text when available.",
  promptSnippet: "analyze_arxiv(paper_id_or_url, include_full_text?) → paper title, abstract, and content",
  parameters: Type.Object({
    paper: Type.String({
      description: "arXiv URL (e.g. https://arxiv.org/abs/2502.09601) or paper ID (e.g. 2502.09601)",
    }),
    include_full_text: Type.Optional(
      Type.Boolean({ description: "Also fetch the full HTML paper body. Default true." }),
    ),
  }),
  async execute(_id, params, signal) {
    const { paper, include_full_text = true } = params;

    const arxivId = extractArxivId(paper);
    if (!arxivId) {
      return {
        content: [{ type: "text" as const, text: `Could not parse arXiv ID from: "${paper}". Provide a URL like https://arxiv.org/abs/2502.09601 or a bare ID.` }],
        details: null,
      };
    }

    let text: string;
    try {
      text = await fetchAbstract(arxivId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Failed to fetch arXiv abstract: ${msg}` }], details: null };
    }

    if (signal?.aborted) {
      return { content: [{ type: "text" as const, text: "Cancelled." }], details: null };
    }

    if (include_full_text) {
      const full = await fetchFullPaper(arxivId).catch(() => null);
      if (full) {
        text += "\n\n---\n\n**Full paper text:**\n\n" + full;
      } else {
        text += "\n\n*(Full HTML paper not available for this ID — abstract only)*";
      }
    }

    return { content: [{ type: "text" as const, text }], details: { arxiv_id: arxivId } };
  },
});
