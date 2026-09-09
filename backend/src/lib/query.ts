/**
 * Shared query-parameter parsing.
 *
 * The rule these encode: a list endpoint without a clamped limit is a bulk
 * export. `?limit=999999` must not be a way to dump the table.
 */

export const MAX_PAGE_SIZE = 100;

/** Clamp a caller-supplied limit into [1, max]. */
export const clampLimit = (value: unknown, fallback = 20, max = MAX_PAGE_SIZE) =>
  Math.min(max, Math.max(1, Number(value) || fallback));

/** Page number, floored at 1. */
export const parsePage = (value: unknown) => Math.max(1, Number(value) || 1);

/** Split a comma-separated param into trimmed, non-empty, de-duplicated tokens. */
export const parseCsv = (value: unknown, max = 10): string[] => {
  if (typeof value !== "string") return [];
  const tokens = value
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
  return [...new Set(tokens)].slice(0, max);
};

/** "true"/"1" -> true, "false"/"0" -> false, anything else -> undefined. */
export const parseBool = (value: unknown): boolean | undefined => {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return undefined;
};

/** A trimmed string, capped in length, or undefined when absent/blank. */
export const parseText = (value: unknown, maxLength = 64): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

/** A finite number within [min, max], or undefined. */
export const parseNumber = (value: unknown, min: number, max: number): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
};

/** Standard envelope for paginated list responses. */
export const paginated = <T>(items: T[], page: number, limit: number) => ({
  items,
  page,
  limit,
  hasMore: items.length === limit,
});

export type DateRange = "today" | "week" | "month" | "all";

export const isDateRange = (v: unknown): v is DateRange =>
  v === "today" || v === "week" || v === "month" || v === "all";

/**
 * Upcoming-show window, matching the vocabulary getShows already uses so the
 * frontend has one mental model for date filtering.
 */
export const dateRangeWindow = (range: DateRange | undefined, past: boolean) => {
  const now = new Date();
  if (past) return { lt: now };
  if (!range || range === "all") return { gte: now };

  const end =
    range === "today"
      ? new Date(new Date().setHours(23, 59, 59, 999))
      : range === "week"
        ? new Date(Date.now() + 7 * 86_400_000)
        : new Date(Date.now() + 30 * 86_400_000);

  return { gte: now, lte: end };
};
