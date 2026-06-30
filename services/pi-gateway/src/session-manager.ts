import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";
import { analyzeArxivTool } from "./tools/analyze-arxiv.js";
import { analyzeGithubTool } from "./tools/analyze-github.js";
import { searchAiDiveTool } from "./tools/search-ai-dive.js";

const GATEWAY_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PI_AGENT_DIR = process.env.PI_AGENT_DIR ?? join(homedir(), ".pi", "agent");

const sessions = new Map<string, AgentSession>();
const lastUsed = new Map<string, number>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function evictStaleSessions() {
  const now = Date.now();
  for (const [userId, ts] of lastUsed) {
    if (now - ts > SESSION_TTL_MS) {
      sessions.get(userId)?.dispose();
      sessions.delete(userId);
      lastUsed.delete(userId);
    }
  }
}

setInterval(evictStaleSessions, 5 * 60 * 1000).unref();

async function makeSession(): Promise<AgentSession> {
  const { session } = await createAgentSession({
    cwd: GATEWAY_DIR,
    agentDir: PI_AGENT_DIR,
    sessionManager: SessionManager.inMemory(),
    noTools: "builtin",
    customTools: [analyzeArxivTool, analyzeGithubTool, searchAiDiveTool],
  });
  return session;
}

export async function getSession(userId: string | undefined): Promise<AgentSession> {
  if (!userId) return makeSession();

  const existing = sessions.get(userId);
  if (existing) {
    lastUsed.set(userId, Date.now());
    return existing;
  }

  const session = await makeSession();
  sessions.set(userId, session);
  lastUsed.set(userId, Date.now());
  return session;
}
