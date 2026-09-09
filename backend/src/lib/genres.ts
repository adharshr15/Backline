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
