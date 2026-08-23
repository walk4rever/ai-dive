import { describe, expect, it } from "vitest";
import { MAX_IMAGES_PER_MESSAGE, validateImageAttachments } from "./image-attachment.js";

describe("validateImageAttachments", () => {
  it("returns undefined for an absent field", () => {
    expect(validateImageAttachments(undefined)).toBeUndefined();
    expect(validateImageAttachments(null)).toBeUndefined();
  });

  it("returns undefined for an empty array", () => {
    expect(validateImageAttachments([])).toBeUndefined();
  });

  it("throws when input is not an array", () => {
    expect(() => validateImageAttachments({ mimeType: "image/png", data: "abc" })).toThrow();
  });

  it("throws when there are more than the max allowed images", () => {
    const images = Array.from({ length: MAX_IMAGES_PER_MESSAGE + 1 }, () => ({
      mimeType: "image/png",
      data: "abc",
    }));
    expect(() => validateImageAttachments(images)).toThrow();
  });

  it("throws on an unsupported mime type", () => {
    expect(() => validateImageAttachments([{ mimeType: "image/svg+xml", data: "abc" }])).toThrow();
  });

  it("throws on missing or empty data", () => {
    expect(() => validateImageAttachments([{ mimeType: "image/png", data: "" }])).toThrow();
    expect(() => validateImageAttachments([{ mimeType: "image/png" }])).toThrow();
  });

  it("throws when data exceeds the max base64 length", () => {
    const oversized = "a".repeat(8_000_001);
    expect(() => validateImageAttachments([{ mimeType: "image/png", data: oversized }])).toThrow();
  });

  it("returns narrowed attachments for valid input", () => {
    const result = validateImageAttachments([{ mimeType: "image/jpeg", data: "abc123" }]);
    expect(result).toEqual([{ mimeType: "image/jpeg", data: "abc123" }]);
  });

  it("strips unexpected extra fields", () => {
    const result = validateImageAttachments([
      { mimeType: "image/webp", data: "xyz", extra: "ignored" },
    ]);
    expect(result).toEqual([{ mimeType: "image/webp", data: "xyz" }]);
  });
});
