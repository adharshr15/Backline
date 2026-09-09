/**
 * Pure helpers for turning the free-text a user (or the legacy Band.genre column)
 * supplies into canonical Genre rows. No database access -- unit tested directly.
 */

export type MatchableGenre = { slug: string; name: string; aliases: string[] };

/** Strip case and punctuation so "Hip-Hop", "hip hop" and "hiphop" compare equal. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Hard separators: characters that never appear inside a genre name.
 *
 * Note what is NOT here: "&" and the word "and". Both are load-bearing inside
 * real names -- "R&B", "Drum & Bass", "rhythm and blues" -- so splitting on them
 * eagerly shreds the very genres they belong to. They are handled as a fallback
 * in matchSegment() instead, only after the whole segment has failed to match.
 */
const SEGMENT_SPLIT = /[,/|;·]|\s{2,}/;

/** Conjunctions, tried only when a segment does not resolve as a whole. */
const CONJUNCTION_SPLIT = /\s+and\s+|\s*&\s*|\s*\+\s*/;

const clean = (s: string) =>
  s.trim().replace(/[^\w\s&-]/g, "").replace(/\s+/g, " ").trim();

/**
 * Split a free-text genre string into candidate segments on hard separators only.
 *
 * "Indie Rock / Shoegaze"     -> ["indie rock", "shoegaze"]
 * "post-rock, math rock, emo" -> ["post-rock", "math rock", "emo"]
 * "drum and bass"             -> ["drum and bass"]   (kept whole; see above)
 */
export const tokenizeGenreText = (raw: string): string[] =>
  raw
    .toLowerCase()
    .split(SEGMENT_SPLIT)
    .map(clean)
    .filter(t => t.length > 1);

/** Resolve one token against slug, display name, then aliases. */
export const matchToken = <T extends MatchableGenre>(
  token: string,
  genres: T[],
): T | undefined => {
  const t = norm(token);
  if (!t) return undefined;

  return genres.find(
    g => norm(g.slug) === t || norm(g.name) === t || g.aliases.some(a => norm(a) === t),
  );
};

/**
 * Resolve one segment: whole first, then split on conjunctions.
 *
 * "drum and bass" matches whole (alias) and returns one genre; "jazz and funk"
 * does not, so it splits and returns two.
 */
const matchSegment = <T extends MatchableGenre>(segment: string, genres: T[]): T[] => {
  const whole = matchToken(segment, genres);
  if (whole) return [whole];

  const parts = segment.split(CONJUNCTION_SPLIT).map(clean).filter(p => p.length > 1);
  if (parts.length < 2) return [];

  return parts.flatMap(p => {
    const hit = matchToken(p, genres);
    return hit ? [hit] : [];
  });
};

/**
 * Resolve a whole free-text string to distinct genres, in the order they appeared.
 * Unmatched tokens are dropped, never guessed at.
 */
export const matchGenreText = <T extends MatchableGenre>(
  raw: string,
  genres: T[],
  limit = 3,
): T[] => {
  // A whole string that is itself a genre wins outright -- "Drum & Bass" must not
  // be split by the segment pass on its own ampersand.
  const whole = matchToken(raw, genres);
  if (whole) return [whole];

  const out: T[] = [];
  const seen = new Set<string>();

  for (const segment of tokenizeGenreText(raw)) {
    for (const match of matchSegment(segment, genres)) {
      if (seen.has(match.slug)) continue;
      seen.add(match.slug);
      out.push(match);
      if (out.length >= limit) return out;
    }
  }

  return out;
};

/** The segments that resolved to nothing -- used to grow the alias map. */
export const unmatchedTokens = (raw: string, genres: MatchableGenre[]): string[] => {
  if (matchToken(raw, genres)) return [];
  return tokenizeGenreText(raw).filter(t => matchSegment(t, genres).length === 0);
};
