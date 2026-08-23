export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export const MAX_HISTORY_TURNS = 10;
const MAX_TEXT_LENGTH = 8000;

/** Validates and narrows an untrusted `history` request field (the Next.js side
 *  should already sanitize this, but the gateway does not trust its caller). Throws
 *  with a user-facing message on the first invalid entry; returns undefined for an
 *  absent/empty field. */
export function validateHistory(input: unknown): HistoryTurn[] | undefined {
  if (input === undefined || input === null) return undefined;
  if (!Array.isArray(input)) {
    throw new Error("history must be an array");
  }
  if (input.length === 0) return undefined;
  if (input.length > MAX_HISTORY_TURNS) {
    throw new Error(`history exceeds ${MAX_HISTORY_TURNS} turns`);
  }

  return input.map((raw) => {
    const turn = raw as { role?: unknown; text?: unknown };
    if (turn.role !== "user" && turn.role !== "assistant") {
      throw new Error("history entries must have role 'user' or 'assistant'");
    }
    if (typeof turn.text !== "string" || turn.text.length === 0 || turn.text.length > MAX_TEXT_LENGTH) {
      throw new Error("history entries must have non-empty text within the length limit");
    }
    return { role: turn.role, text: turn.text };
  });
}
