/**
 * Explore post ranking.
 *
 * Pure: no Prisma, so it is unit-tested without a database. explorePosts.ts
 * gathers the candidates; this only decides their order.
 */

export const WEIGHTS = {
  local: 3,
  followedOwner: 2,
  followedScene: 1,
  genreMatch: 1,
} as const;

/** One 3x3 grid on the Explore page. */
export const BLOCK_SIZE = 9;
export const ROW_SIZE = 3;
/** Ceiling on the ranked list, so a cursor offset is bounded too. 50 blocks. */
export const MAX_RANKED = 450;

const PER_OWNER_PER_BLOCK = 2;
/** A post loses one point per fortnight of age. */
const DECAY_DAYS = 14;
const ENGAGEMENT_WEIGHT = 0.5;
const DAY_MS = 86_400_000;

export type Signals = { [K in keyof typeof WEIGHTS]: boolean };

export type PostCandidate = {
  id: string;
  /** "BAND:<id>" etc. -- whose grid a post would crowd. */
  ownerKey: string;
  createdAt: Date;
  likes: number;
  comments: number;
  signals: Signals;
};

export const scorePost = (post: PostCandidate, now: Date): number => {
  const ageDays = Math.max(0, (now.getTime() - post.createdAt.getTime()) / DAY_MS);

  let score = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof Signals)[]) {
    if (post.signals[key]) score += WEIGHTS[key];
  }

  return (
    score +
    ENGAGEMENT_WEIGHT * Math.log1p(post.likes + 2 * post.comments) -
    ageDays / DECAY_DAYS
  );
};

/**
 * Merge, score, order and block the candidates.
 *
 * A post can arrive from several pools (local AND from a followed band), so
 * duplicates are merged with their signals OR-ed. Ties break on id: the cursor
 * pages by offset, so the order must be identical on every call.
 *
 * Each block of nine holds at most two posts per owner, so one prolific band
 * cannot fill a whole grid. The cap is relaxed rather than leave a block short
 * -- a short block would misalign every block after it.
 *
 * The result is trimmed to whole rows of three.
 */
export const rankPosts = <T extends PostCandidate>(candidates: T[], now: Date): T[] => {
  const byId = new Map<string, T>();
  for (const c of candidates) {
    const seen = byId.get(c.id);
    if (!seen) {
      byId.set(c.id, c);
      continue;
    }
    const signals = { ...seen.signals };
    for (const key of Object.keys(signals) as (keyof Signals)[]) {
      signals[key] = signals[key] || c.signals[key];
    }
    byId.set(c.id, { ...seen, signals });
  }

  const scored = [...byId.values()].map(post => ({ post, score: scorePost(post, now) }));
  scored.sort((a, b) => b.score - a.score || (a.post.id < b.post.id ? -1 : a.post.id > b.post.id ? 1 : 0));

  let pending = scored.map(s => s.post);
  const out: T[] = [];

  while (pending.length && out.length < MAX_RANKED) {
    const block: T[] = [];
    const deferred: T[] = [];
    const perOwner = new Map<string, number>();

    for (const post of pending) {
      const n = perOwner.get(post.ownerKey) ?? 0;
      if (block.length === BLOCK_SIZE || n >= PER_OWNER_PER_BLOCK) {
        deferred.push(post);
        continue;
      }
      perOwner.set(post.ownerKey, n + 1);
      block.push(post);
    }

    // Relax the owner cap rather than leave the block short.
    if (block.length < BLOCK_SIZE) {
      block.push(...deferred.splice(0, BLOCK_SIZE - block.length));
    }

    out.push(...block);
    pending = deferred;
  }

  const capped = Math.min(out.length, MAX_RANKED);
  return out.slice(0, capped - (capped % ROW_SIZE));
};
