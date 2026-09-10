import { prisma } from "./prisma";
import { GENRE_SEED } from "./genres.seed";

/**
 * Upsert the canonical taxonomy. Idempotent, so it is safe to re-run after
 * editing GENRE_SEED (e.g. adding aliases the backfill report turned up).
 *
 * Two passes: roots first, then children, so `parent` slugs always resolve.
 * Shared by scripts/seed-genres.ts and tests/helpers.ts::seedGenres() -- that
 * shared call is what keeps the test taxonomy and the production one identical.
 */
/**
 * Resolve caller-supplied genre tokens to Genre ids, accepting slugs, display
 * names or aliases -- so "shoegaze", "Shoegaze" and "nugaze" all work, and the
 * labels the shipped frontend chips send ("R&B", "Hip-Hop") keep resolving.
 *
 * Returns an empty array when nothing matches. Callers should treat that as "no
 * results" rather than a bad request: a filter that rejects a typo is hostile.
 */
export const resolveGenreIds = async (tokens: string[]): Promise<string[]> => {
  if (tokens.length === 0) return [];
  const lowered = tokens.map(t => t.toLowerCase());

  const genres = await prisma.genre.findMany({
    where: {
      OR: [
        { slug: { in: lowered } },
        { name: { in: tokens, mode: "insensitive" } },
        { aliases: { hasSome: lowered } },
      ],
    },
    select: { id: true },
  });

  return genres.map(g => g.id);
};

/** A band carries at most this many genres; position 0 is the primary. */
export const MAX_BAND_GENRES = 3;

const GENRES_SHAPE_ERROR = "genres must be a list of genre slugs";

/**
 * Parse and resolve the `genres` field of a band create or update.
 *
 *   field omitted   -> {}                 leave the band's set alone
 *   []              -> { genreIds: [] }   clear it
 *   ["a", "b"]      -> { genreIds }       in the order given, duplicates collapsed
 *
 * Accepts an array (JSON body, or multipart `genres[]`) or a JSON-encoded string,
 * because the app sends FormData, which cannot carry an array -- and an empty
 * array has to be expressible so a band can clear its genres.
 *
 * Unlike resolveGenreIds this is strict: slugs only, and an unknown one is an
 * error. A filter should tolerate a typo; a write must not silently drop part of
 * what was asked for.
 */
export const parseBandGenres = async (
  raw: unknown,
): Promise<{ genreIds?: string[]; error?: string }> => {
  if (raw === undefined) return {};

  let list: unknown = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (text === "") {
      list = [];
    } else {
      try {
        list = JSON.parse(text);
      } catch {
        return { error: GENRES_SHAPE_ERROR };
      }
    }
  }

  if (!Array.isArray(list) || !list.every(s => typeof s === "string")) {
    return { error: GENRES_SHAPE_ERROR };
  }

  const slugs = [...new Set((list as string[]).map(s => s.trim().toLowerCase()).filter(Boolean))];
  if (slugs.length > MAX_BAND_GENRES) {
    return { error: `At most ${MAX_BAND_GENRES} genres` };
  }
  if (slugs.length === 0) return { genreIds: [] };

  const found = await prisma.genre.findMany({
    where: { slug: { in: slugs }, isActive: true },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(found.map(g => [g.slug, g.id]));

  const unknown = slugs.filter(s => !idBySlug.has(s));
  if (unknown.length) return { error: `Unknown genre: ${unknown.join(", ")}` };

  return { genreIds: slugs.map(s => idBySlug.get(s)!) };
};

export const syncGenreSeed = async () => {
  const roots = GENRE_SEED.filter(g => !g.parent);
  const children = GENRE_SEED.filter(g => g.parent);

  for (const g of roots) {
    await prisma.genre.upsert({
      where: { slug: g.slug },
      create: {
        slug: g.slug,
        name: g.name,
        aliases: g.aliases ?? [],
        sortOrder: g.sortOrder ?? 100,
      },
      update: {
        name: g.name,
        aliases: g.aliases ?? [],
        sortOrder: g.sortOrder ?? 100,
        parentId: null,
      },
    });
  }

  for (const g of children) {
    const parent = await prisma.genre.findUnique({
      where: { slug: g.parent! },
      select: { id: true },
    });
    if (!parent) {
      throw new Error(`Genre "${g.slug}" names an unknown parent "${g.parent}"`);
    }

    await prisma.genre.upsert({
      where: { slug: g.slug },
      create: {
        slug: g.slug,
        name: g.name,
        aliases: g.aliases ?? [],
        sortOrder: g.sortOrder ?? 100,
        parentId: parent.id,
      },
      update: {
        name: g.name,
        aliases: g.aliases ?? [],
        sortOrder: g.sortOrder ?? 100,
        parentId: parent.id,
      },
    });
  }

  return { roots: roots.length, children: children.length };
};
