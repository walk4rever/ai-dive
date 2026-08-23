import { describe, expect, it } from "vitest";
import { MAX_HISTORY_TURNS, validateHistory } from "./history.js";

describe("validateHistory", () => {
  it("returns undefined for an absent field", () => {
    expect(validateHistory(undefined)).toBeUndefined();
    expect(validateHistory(null)).toBeUndefined();
  });

  it("returns undefined for an empty array", () => {
    expect(validateHistory([])).toBeUndefined();
  });

  it("throws when input is not an array", () => {
    expect(() => validateHistory({ role: "user", text: "hi" })).toThrow();
  });

  it("throws when there are more than the max allowed turns", () => {
    const turns = Array.from({ length: MAX_HISTORY_TURNS + 1 }, () => ({ role: "user", text: "hi" }));
    expect(() => validateHistory(turns)).toThrow();
  });

  it("throws on an invalid role", () => {
    expect(() => validateHistory([{ role: "system", text: "hi" }])).toThrow();
  });

  it("throws on missing or empty text", () => {
    expect(() => validateHistory([{ role: "user", text: "" }])).toThrow();
    expect(() => validateHistory([{ role: "user" }])).toThrow();
  });

  it("throws when text exceeds the max length", () => {
    const oversized = "a".repeat(8001);
    expect(() => validateHistory([{ role: "user", text: oversized }])).toThrow();
  });

  it("returns narrowed turns for valid input", () => {
    const result = validateHistory([
      { role: "user", text: "我叫小明" },
      { role: "assistant", text: "记住了" },
    ]);
    expect(result).toEqual([
      { role: "user", text: "我叫小明" },
      { role: "assistant", text: "记住了" },
    ]);
  });

  it("strips unexpected extra fields", () => {
    const result = validateHistory([{ role: "user", text: "hi", extra: "ignored" }]);
    expect(result).toEqual([{ role: "user", text: "hi" }]);
  });
});
