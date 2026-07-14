import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { pool } from "../db.js";

type StoryRow = {
  title: string;
  excerpt: string;
  body_markdown: string | null;
  content: string;
  content_type: string;
  published_at: string | null;
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Legacy rows only have rendered HTML (KaTeX output), no stored markdown source.
// Pull the original LaTeX out of KaTeX's MathML annotation before stripping tags,
// so formulas survive as `$...$` instead of turning into rendered-glyph soup.
function htmlToReadableText(html: string): string {
  const withFormulas = html.replace(
    /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g,
    (_, tex) => ` $${decodeHtmlEntities(tex)}$ `,
  );

  return decodeHtmlEntities(
    withFormulas
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
}

export const getArticleContentTool = defineTool({
  name: "get_article_content",
  label: "Get AI-DIVE Article Content",
  description:
    "Fetch the full text of a published AI-DIVE article by slug, including original formula source (LaTeX) rather than rendered markup. Use this when the reader's question needs exact quotes, section detail, or formula specifics beyond the title/excerpt already known from the session context.",
  promptSnippet: "get_article_content(slug) → full article text with formulas as LaTeX source",
  parameters: Type.Object({
    slug: Type.String({ description: "AI-DIVE article slug, e.g. harness-engineering-self-improvement" }),
  }),
  async execute(_id, params, signal) {
    const { slug } = params;

    if (signal?.aborted) {
      return { content: [{ type: "text" as const, text: "Cancelled." }], details: null };
    }

    let row: StoryRow | undefined;
    try {
      const result = await pool.query<StoryRow>(
        `SELECT title, excerpt, body_markdown, content, content_type, to_char(published_at, 'YYYY-MM-DD') AS published_at
         FROM ai_pulse_stories
         WHERE slug = $1 AND status = 'published' AND is_premium = false
         LIMIT 1`,
        [slug],
      );
      row = result.rows[0];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Failed to fetch article: ${msg}` }], details: null };
    }

    if (!row) {
      return {
        content: [{ type: "text" as const, text: `No published AI-DIVE article found with slug "${slug}".` }],
        details: null,
      };
    }

    const body = row.body_markdown ?? htmlToReadableText(row.content);

    const text = [
      `**${row.title}**`,
      row.published_at ? `Published: ${row.published_at}` : "",
      "",
      body,
    ].filter((l) => l !== undefined).join("\n");

    return { content: [{ type: "text" as const, text }], details: { slug, has_markdown_source: row.body_markdown !== null } };
  },
});
