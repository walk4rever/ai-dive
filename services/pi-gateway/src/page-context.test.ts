import { describe, expect, it } from "vitest";
import { pageContextKey, parsePageContext } from "./page-context";

describe("page context", () => {
  it("keys article and intel-day sessions separately", () => {
    expect(pageContextKey({ kind: "article", id: "my-article" })).toBe("my-article");
    expect(pageContextKey({ kind: "intel_day", id: "2026-10-18" })).toBe("intel-day:2026-10-18");
    expect(pageContextKey()).toBe("global");
  });

  it("validates intel dates", () => {
    expect(parsePageContext({ kind: "intel_day", id: "2026-10-18" })).toEqual({
      kind: "intel_day",
      id: "2026-10-18",
    });
    expect(parsePageContext({ kind: "intel_day", id: "2026-02-31" })).toBeUndefined();
  });
});
