import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webSearchTool } from "./web-search";

const originalKey = process.env.DEEPSEEK_API_KEY;

type ToolOutput = { content: Array<{ text: string }>; details: unknown };
const execute = (webSearchTool as unknown as {
  execute(
    id: string,
    params: { query: string; count?: number; include_content?: boolean },
    signal?: AbortSignal,
  ): Promise<ToolOutput>;
}).execute;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const result = {
  rerank_score: 2.4,
  title: "DeepSeek V4 released",
  url: "https://example.com/deepseek-v4",
  snippet: "Short snippet",
  summary: "Long summary about the release.",
  content: "Full page content",
  site_name: "Example News",
  date: "2026-06-01T00:00:00+00:00",
  authority: 3,
};

async function run(params: { query: string; count?: number; include_content?: boolean }) {
  return execute("call", params);
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.DEEPSEEK_RETRY_DELAY_MS = "0";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
  delete process.env.DEEPSEEK_RETRY_DELAY_MS;
});

describe("web_search", () => {
  it("calls the DeepSeek search API and formats results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ results: [result] }));
    vi.stubGlobal("fetch", fetchMock);

    const output = await run({ query: "DeepSeek V4" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/v1/tools/search");
    expect(JSON.parse(init.body)).toMatchObject({
      query: "DeepSeek V4",
      count: 5,
      need_content: false,
    });
    expect(output.content[0].text).toContain("DeepSeek V4 released");
    expect(output.content[0].text).toContain("https://example.com/deepseek-v4");
    expect(output.content[0].text).toContain("authority 3");
    expect(output.details).toEqual({ query: "DeepSeek V4", count: 1 });
  });

  it("clamps the result count and limits content requests to three", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ results: [result] }));
    vi.stubGlobal("fetch", fetchMock);

    await run({ query: "x", count: 99 });
    await run({ query: "x", count: 99, include_content: true });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).count).toBe(10);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).count).toBe(3);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).need_content).toBe(true);
  });

  it("returns a friendly message when there are no results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ results: [] })));

    const output = await run({ query: "nothing here" });

    expect(output.content[0].text).toContain("No web results found");
    expect(output.details).toEqual({ query: "nothing here", count: 0 });
  });

  it("surfaces a balance error without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({ error: { message: "Insufficient Balance" } }, 402),
    );
    vi.stubGlobal("fetch", fetchMock);

    const output = await run({ query: "x" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(output.content[0].text).toContain("balance is insufficient");
  });

  it("retries a 429 once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "rate limited" } }, 429))
      .mockResolvedValueOnce(json({ results: [result] }));
    vi.stubGlobal("fetch", fetchMock);

    const output = await run({ query: "x" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(output.content[0].text).toContain("DeepSeek V4 released");
  });

  it("reports a missing API key without calling fetch", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const output = await run({ query: "x" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(output.content[0].text).toContain("DEEPSEEK_API_KEY");
  });
});
