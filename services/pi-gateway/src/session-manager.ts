import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { READER_TOOLS } from "./tools/index.js";
import {
  ALLOWED_TOOL_NAMES,
  GATEWAY_DIR,
  PI_AGENT_DIR,
  buildReaderResourceLoader,
  type AgentContextFile,
} from "./agent-config.js";
import { pool } from "./db.js";
import type { HistoryTurn } from "./history.js";
import { pageContextKey, type PageContext } from "./page-context.js";

// Display-only fields required by AssistantMessage's type but not sent to the real
// LLM on replay — seeded history is appended via SessionManager.appendMessage(),
// which never triggers a completion call. Mirrors the provider/model actually
// configured in .pi-agent/models.json.
const SEED_API = "openai-completions";
const SEED_PROVIDER = "deepseek";
const SEED_MODEL = "deepseek-v4-flash";

type SessionMessage = Parameters<SessionManager["appendMessage"]>[0];

function buildSeedMessages(history: HistoryTurn[]): SessionMessage[] {
  return history.map((turn) => {
    const timestamp = Date.now();
    if (turn.role === "user") {
      return { role: "user", content: turn.text, timestamp };
    }
    return {
      role: "assistant",
      content: [{ type: "text", text: turn.text }],
      api: SEED_API,
      provider: SEED_PROVIDER,
      model: SEED_MODEL,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp,
    };
  });
}

const sessions = new Map<string, AgentSession>();
const lastUsed = new Map<string, number>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function evictStaleSessions() {
  const now = Date.now();
  for (const [key, ts] of lastUsed) {
    if (now - ts > SESSION_TTL_MS) {
      sessions.get(key)?.dispose();
      sessions.delete(key);
      lastUsed.delete(key);
    }
  }
}

setInterval(evictStaleSessions, 5 * 60 * 1000).unref();

async function fetchArticleTitle(slug: string): Promise<string | null> {
  try {
    const result = await pool.query<{ title: string }>(
      `SELECT title FROM ai_pulse_stories WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [slug],
    );
    return result.rows[0]?.title ?? null;
  } catch (err) {
    // Article context is a convenience: if the lookup fails, answer without the
    // title instead of holding the whole chat request at session creation.
    console.error("fetchArticleTitle failed", slug, err instanceof Error ? err.message : err);
    return null;
  }
}

// Binds a session to one article: appends a virtual context file (on top of the
// static AGENTS.md persona) telling the model which article this is and that
// get_article_content can fetch the full text/formulas on demand. This costs
// tokens once at session creation, not on every turn.
async function buildArticleContextFiles(articleSlug: string): Promise<AgentContextFile[]> {
  const title = await fetchArticleTitle(articleSlug);
  if (!title) return [];

  return [{
    path: `/virtual/article-${articleSlug}.md`,
    content: [
      "# Current Article Context",
      "",
      `The reader is currently viewing AI-DIVE article "${title}" (slug: ${articleSlug}).`,
      `Call get_article_content("${articleSlug}") to fetch the full text (original markdown source, including LaTeX formulas) when the question needs exact quotes, section detail, or formula specifics.`,
      "Distinguish what the article actually says (quote or closely paraphrase it) from your own elaboration (say so explicitly).",
    ].join("\n"),
  }];
}

function buildIntelDayContextFiles(date: string): AgentContextFile[] {
  return [{
    path: `/virtual/intel-day-${date}.md`,
    content: [
      "# Current Intel Day Context",
      "",
      `The reader is viewing AI-DIVE's daily intel page for ${date}.`,
      `Call get_intel_day("${date}") before answering questions about that day's signals.`,
      "Use the signal titles, summaries, sources, categories, site anchors, and original URLs returned by the tool.",
      "Distinguish the published signal summaries from your own analysis. Do not invent article details that the summaries do not contain.",
    ].join("\n"),
  }];
}

async function buildPageContextFiles(context?: PageContext): Promise<AgentContextFile[]> {
  if (context?.kind === "article") return buildArticleContextFiles(context.id);
  if (context?.kind === "intel_day") return buildIntelDayContextFiles(context.id);
  return [];
}

async function makeSession(context?: PageContext, history?: HistoryTurn[]): Promise<AgentSession> {
  const contextFiles = await buildPageContextFiles(context);
  const resourceLoader = await buildReaderResourceLoader(contextFiles);

  const sessionManager = SessionManager.inMemory();
  if (history) {
    for (const message of buildSeedMessages(history)) {
      sessionManager.appendMessage(message);
    }
  }

  const { session } = await createAgentSession({
    cwd: GATEWAY_DIR,
    agentDir: PI_AGENT_DIR,
    sessionManager,
    noTools: "builtin",
    tools: [...ALLOWED_TOOL_NAMES],
    customTools: READER_TOOLS,
    resourceLoader,
  });

  const active = session.getActiveToolNames().slice().sort();
  const expected = [...ALLOWED_TOOL_NAMES].sort();
  if (active.join(",") !== expected.join(",")) {
    session.dispose();
    throw new Error(`Agent tool allowlist mismatch. Active: ${active.join(", ") || "(none)"}`);
  }

  return session;
}

function sessionKey(userId: string, context?: PageContext): string {
  return `${userId}:${pageContextKey(context)}`;
}

export async function getSession(
  userId: string | undefined,
  context?: PageContext,
  history?: HistoryTurn[],
): Promise<AgentSession> {
  if (!userId) return makeSession(context, history);

  const key = sessionKey(userId, context);
  const existing = sessions.get(key);
  if (existing) {
    lastUsed.set(key, Date.now());
    return existing;
  }

  // Only a freshly created (cold-start) session gets seeded with prior history —
  // an already-warm session already remembers the conversation and must not be
  // touched here.
  const session = await makeSession(context, history);
  sessions.set(key, session);
  lastUsed.set(key, Date.now());
  return session;
}

// Looks up a session without creating one — used by /cancel, which must be a
// no-op for a userId/context pair that never started a session (already
// finished, already evicted, or never existed) rather than spinning one up.
export function getExistingSession(userId: string | undefined, context?: PageContext): AgentSession | undefined {
  if (!userId) return undefined;
  return sessions.get(sessionKey(userId, context));
}
