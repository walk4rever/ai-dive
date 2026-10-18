import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { pool } from "../db.js";
import { parsePageContext } from "../page-context.js";

type IntelSignalRow = {
  id: string;
  title: string;
  description: string;
  url: string;
  source_name: string | null;
  signal_date: string;
  category: string | null;
};

export const getIntelDayTool = defineTool({
  name: "get_intel_day",
  label: "Get AI-DIVE Intel Day",
  description:
    "Fetch every enabled AI-DIVE intel signal for a specific date. Returns each item's title, summary, source, category, site anchor, and original URL. Use this before answering questions about the daily intel page.",
  promptSnippet: "get_intel_day(date) → all intel signals for a YYYY-MM-DD date",
  parameters: Type.Object({
    date: Type.String({
      description: "Calendar date in YYYY-MM-DD format, e.g. 2026-10-18",
    }),
  }),
  async execute(_id, params, signal) {
    if (!parsePageContext({ kind: "intel_day", id: params.date })) {
      return {
        content: [{ type: "text" as const, text: `Invalid intel date "${params.date}". Use YYYY-MM-DD.` }],
        details: null,
      };
    }

    if (signal?.aborted) {
      return { content: [{ type: "text" as const, text: "Cancelled." }], details: null };
    }

    let rows: IntelSignalRow[];
    try {
      const result = await pool.query<IntelSignalRow>(
        `
        SELECT
          id,
          title,
          description,
          url,
          source_name,
          to_char(signal_date, 'YYYY-MM-DD') AS signal_date,
          metadata->>'category' AS category
        FROM ai_pulse_signals
        WHERE status = 'enabled'
          AND signal_date = $1
        ORDER BY created_at DESC, id DESC
        `,
        [params.date],
      );
      rows = result.rows;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to fetch intel day: ${message}` }],
        details: null,
      };
    }

    if (rows.length === 0) {
      return {
        content: [{ type: "text" as const, text: `No enabled AI-DIVE intel signals found for ${params.date}.` }],
        details: { date: params.date, count: 0 },
      };
    }

    const text = rows
      .map((row, index) => [
        `## ${index + 1}. ${row.title}`,
        row.source_name ? `Source: ${row.source_name}` : "",
        row.category ? `Category: ${row.category}` : "",
        `AI-DIVE page: https://ai.air7.fun/intels/${row.signal_date}#signal-${row.id}`,
        `Original: ${row.url}`,
        "",
        row.description,
      ].filter(Boolean).join("\n"))
      .join("\n\n---\n\n");

    return {
      content: [{
        type: "text" as const,
        text: `# AI-DIVE Intel · ${params.date}\n\n${rows.length} enabled signals.\n\n${text}`,
      }],
      details: { date: params.date, count: rows.length },
    };
  },
});
