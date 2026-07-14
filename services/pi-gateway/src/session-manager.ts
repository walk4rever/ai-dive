import { createAgentSession, DefaultResourceLoader, SessionManager } from "@earendil-works/pi-coding-agent";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";
import { analyzeArxivTool } from "./tools/analyze-arxiv.js";
import { analyzeGithubTool } from "./tools/analyze-github.js";
import { searchAiDiveTool } from "./tools/search-ai-dive.js";
import { getArticleContentTool } from "./tools/get-article-content.js";
import { pool } from "./db.js";

const GATEWAY_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PI_AGENT_DIR = process.env.PI_AGENT_DIR ?? join(homedir(), ".pi", "agent");

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
  const result = await pool.query<{ title: string }>(
    `SELECT title FROM ai_pulse_stories WHERE slug = $1 AND status = 'published' LIMIT 1`,
    [slug],
  );
  return result.rows[0]?.title ?? null;
}

// Binds a session to one article: appends a virtual context file (on top of the
// static AGENTS.md persona) telling the model which article this is and that
// get_article_content can fetch the full text/formulas on demand. This costs
// tokens once at session creation, not on every turn.
async function buildArticleResourceLoader(articleSlug: string): Promise<DefaultResourceLoader | undefined> {
  const title = await fetchArticleTitle(articleSlug);
  if (!title) return undefined;

  const loader = new DefaultResourceLoader({
    cwd: GATEWAY_DIR,
    agentDir: PI_AGENT_DIR,
    agentsFilesOverride: (current) => ({
      agentsFiles: [
        ...current.agentsFiles,
        {
          path: `/virtual/article-${articleSlug}.md`,
          content: [
            "# Current Article Context",
            "",
            `The reader is currently viewing AI-DIVE article "${title}" (slug: ${articleSlug}).`,
            `Call get_article_content("${articleSlug}") to fetch the full text (original markdown source, including LaTeX formulas) when the question needs exact quotes, section detail, or formula specifics.`,
            "Distinguish what the article actually says (quote or closely paraphrase it) from your own elaboration (say so explicitly).",
          ].join("\n"),
        },
      ],
    }),
  });
  await loader.reload();
  return loader;
}

async function makeSession(articleSlug?: string): Promise<AgentSession> {
  const resourceLoader = articleSlug ? await buildArticleResourceLoader(articleSlug) : undefined;

  const { session } = await createAgentSession({
    cwd: GATEWAY_DIR,
    agentDir: PI_AGENT_DIR,
    sessionManager: SessionManager.inMemory(),
    noTools: "builtin",
    customTools: [analyzeArxivTool, analyzeGithubTool, searchAiDiveTool, getArticleContentTool],
    resourceLoader,
  });
  return session;
}

export async function getSession(userId: string | undefined, articleSlug?: string): Promise<AgentSession> {
  if (!userId) return makeSession(articleSlug);

  const key = `${userId}:${articleSlug ?? "global"}`;
  const existing = sessions.get(key);
  if (existing) {
    lastUsed.set(key, Date.now());
    return existing;
  }

  const session = await makeSession(articleSlug);
  sessions.set(key, session);
  lastUsed.set(key, Date.now());
  return session;
}
