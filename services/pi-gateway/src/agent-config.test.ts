import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, describe, expect, it, vi } from "vitest";

// The tool registry imports the pg pool module, which requires DIRECT_URL at
// module load. No connection is opened; this only lets the registry load.
vi.hoisted(() => {
  process.env.DIRECT_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
});
import {
  ALLOWED_TOOL_NAMES,
  READER_SYSTEM_PROMPT,
  buildReaderResourceLoader,
} from "./agent-config";
import { READER_TOOLS } from "./tools/index";

const agentDir = mkdtempSync(join(tmpdir(), "ai-dive-agent-"));

afterAll(() => {
  rmSync(agentDir, { recursive: true, force: true });
});

describe("reader agent configuration", () => {
  it("exposes exactly the allowlisted tools", () => {
    const registered = READER_TOOLS.map((tool) => tool.name).sort();
    expect(registered).toEqual([...ALLOWED_TOOL_NAMES].sort());
    expect(registered).not.toContain("run_experiment");
    expect(registered).not.toContain("bash");
  });

  it("uses a reader-facing system prompt", () => {
    expect(READER_SYSTEM_PROMPT).toContain("AI-DIVE");
    expect(READER_SYSTEM_PROMPT).not.toContain("coding assistant");
  });

  it("loads only the gateway persona and explicit page context", async () => {
    const loader = await buildReaderResourceLoader(
      [{ path: "/virtual/page.md", content: "PAGE CONTEXT" }],
      agentDir,
    );
    const files = (loader as unknown as {
      agentsFiles: Array<{ path: string; content: string }>;
    }).agentsFiles;

    expect(files.map((file) => file.path)).toEqual([
      "/virtual/AGENTS.md",
      "/virtual/page.md",
    ]);
    expect(files[0].content).toContain("Tool routing");
    expect(files[0].content).toContain("Untrusted web content");
    expect(files.some((file) => file.path.includes("CLAUDE.md"))).toBe(false);
  });
});
