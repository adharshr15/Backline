import { MAX_RANKED } from "./postRanking";

/**
 * Opaque cursor for GET /explore/posts.
 *
 * `asOf` pins the candidate pool: every page ranks only posts created at or
 * before it, so a post uploaded mid-scroll cannot shift the offsets and repeat
 * a tile. `offset` is the position in that ranked list.
 *
 * It is caller-supplied, so it is validated as strictly as any other input.
 */

export type ExploreCursor = { asOf: Date; offset: number };

const MAX_CURSOR_LENGTH = 200;
/** Tolerate a little clock drift between app servers. */
const CLOCK_SKEW_MS = 60_000;

export const encodeCursor = ({ asOf, offset }: ExploreCursor): string =>
  Buffer.from(JSON.stringify({ a: asOf.toISOString(), o: offset })).toString("base64url");

/** The decoded cursor, or null for anything malformed or out of range. */
export const decodeCursor = (value: unknown, now = new Date()): ExploreCursor | null => {
  if (typeof value !== "string" || !value || value.length > MAX_CURSOR_LENGTH) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const { a, o } = parsed as Record<string, unknown>;
  if (typeof a !== "string" || typeof o !== "number") return null;
  if (!Number.isInteger(o) || o < 0 || o > MAX_RANKED) return null;

  const asOf = new Date(a);
  if (Number.isNaN(asOf.getTime())) return null;
  if (asOf.getTime() > now.getTime() + CLOCK_SKEW_MS) return null;

  return { asOf, offset: o };
};
