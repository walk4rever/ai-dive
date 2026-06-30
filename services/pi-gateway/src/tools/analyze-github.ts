import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // optional — raises rate limit from 60 to 5000 req/hr

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "ai-dive-agent/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) h["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

function parseRepoUrl(input: string): { owner: string; repo: string; filePath?: string } | null {
  // Handles: full URL, owner/repo, owner/repo/blob/branch/path, owner/repo/tree/branch/path
  const full = input.match(/github\.com\/([^/]+)\/([^/\s?#]+)(?:\/(?:blob|tree)\/[^/]+\/([\s\S]+?))?(?:[?#].*)?$/i);
  if (full) return { owner: full[1], repo: full[2].replace(/\.git$/, ""), filePath: full[3] };
  const short = input.match(/^([^/\s]+)\/([^/\s]+)(?:\/([\s\S]+))?$/);
  if (short) return { owner: short[1], repo: short[2].replace(/\.git$/, ""), filePath: short[3] };
  return null;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: githubHeaders(), signal });
  if (res.status === 404) throw new Error("Not found (repo may be private or doesn't exist)");
  if (res.status === 403) throw new Error("GitHub rate limit exceeded. Set GITHUB_TOKEN env var to increase limits.");
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function getRepoInfo(owner: string, repo: string, signal?: AbortSignal): Promise<string> {
  const info = await fetchJson<{
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    topics: string[];
    created_at: string;
    updated_at: string;
    license: { name: string } | null;
  }>(`https://api.github.com/repos/${owner}/${repo}`, signal);

  return [
    `**${owner}/${repo}**`,
    info.description ? info.description : "",
    `Stars: ${info.stargazers_count.toLocaleString()} · Forks: ${info.forks_count.toLocaleString()} · Language: ${info.language ?? "N/A"}`,
    info.topics.length ? `Topics: ${info.topics.join(", ")}` : "",
    info.license ? `License: ${info.license.name}` : "",
    `Updated: ${info.updated_at.slice(0, 10)}`,
  ].filter(Boolean).join("\n");
}

async function getReadme(owner: string, repo: string, signal?: AbortSignal): Promise<string> {
  try {
    const data = await fetchJson<{ content: string }>(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      signal,
    );
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    return decoded.length > 6000 ? decoded.slice(0, 6000) + "\n\n[README truncated]" : decoded;
  } catch {
    return "(README not available)";
  }
}

async function getFileTree(owner: string, repo: string, signal?: AbortSignal): Promise<string> {
  try {
    const data = await fetchJson<{ tree: { path: string; type: string }[] }>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      signal,
    );
    const files = data.tree
      .filter(f => f.type === "blob")
      .map(f => f.path)
      // Skip generated/vendor files
      .filter(p => !p.includes("node_modules") && !p.includes(".lock") && !p.startsWith("."))
      .slice(0, 120);
    return files.join("\n");
  } catch {
    return "(File tree not available)";
  }
}

async function getFileContent(owner: string, repo: string, filePath: string, signal?: AbortSignal): Promise<string> {
  const data = await fetchJson<{ content: string; encoding: string }>(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    signal,
  );
  if (data.encoding !== "base64") return "(Unsupported encoding)";
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return content.length > 8000 ? content.slice(0, 8000) + "\n\n[file truncated]" : content;
}

export const analyzeGithubTool = defineTool({
  name: "analyze_github",
  label: "Analyze GitHub Repository",
  description:
    "Fetch and analyze a GitHub repository. Returns repo metadata, README, and file structure. Can also read specific files. Accepts GitHub URL or owner/repo shorthand.",
  promptSnippet: "analyze_github(repo, file_path?) → repo info, README, file tree, or specific file content",
  parameters: Type.Object({
    repo: Type.String({
      description: "GitHub URL (https://github.com/owner/repo) or shorthand (owner/repo)",
    }),
    file_path: Type.Optional(
      Type.String({
        description: "Read a specific file (e.g. 'src/server.ts'). If omitted, returns repo info + README + file tree.",
      }),
    ),
  }),
  async execute(_id, params, signal) {
    const { repo: repoInput, file_path } = params;

    const parsed = parseRepoUrl(repoInput);
    if (!parsed) {
      return {
        content: [{ type: "text" as const, text: `Could not parse GitHub URL: "${repoInput}". Use https://github.com/owner/repo or owner/repo.` }],
        details: null,
      };
    }

    const { owner, repo } = parsed;
    const targetFile = file_path ?? parsed.filePath;

    try {
      if (targetFile) {
        const content = await getFileContent(owner, repo, targetFile, signal ?? undefined);
        return {
          content: [{ type: "text" as const, text: `**${owner}/${repo} — ${targetFile}**\n\n\`\`\`\n${content}\n\`\`\`` }],
          details: { owner, repo, file: targetFile },
        };
      }

      const [info, readme, tree] = await Promise.all([
        getRepoInfo(owner, repo, signal ?? undefined),
        getReadme(owner, repo, signal ?? undefined),
        getFileTree(owner, repo, signal ?? undefined),
      ]);

      const text = [
        info,
        "\n---\n\n**README:**\n",
        readme,
        "\n---\n\n**File tree:**\n",
        tree,
      ].join("\n");

      return { content: [{ type: "text" as const, text }], details: { owner, repo } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `GitHub fetch failed: ${msg}` }], details: null };
    }
  },
});
