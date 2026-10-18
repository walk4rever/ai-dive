export type PageContext =
  | { kind: "article"; id: string }
  | { kind: "intel_day"; id: string };

function isYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
  );
}

export function parsePageContext(value: unknown): PageContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { kind?: unknown; id?: unknown };
  if (typeof candidate.id !== "string") return undefined;

  const id = candidate.id.trim();
  if (!id || id.length > 200) return undefined;
  if (candidate.kind === "article") return { kind: "article", id };
  if (candidate.kind === "intel_day" && isYmd(id)) return { kind: "intel_day", id };
  return undefined;
}

export function pageContextKey(context?: PageContext): string {
  if (!context) return "global";
  return context.kind === "intel_day" ? `intel-day:${context.id}` : context.id;
}
