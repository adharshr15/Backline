import { describe, it, expect } from "vitest";
import {
  scorePost,
  rankPosts,
  WEIGHTS,
  MAX_RANKED,
  PostCandidate,
} from "../../src/lib/postRanking";

const NOW = new Date("2026-09-11T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

let seq = 0;
const candidate = (overrides: Partial<PostCandidate> = {}): PostCandidate => ({
  id: overrides.id ?? `p${String(++seq).padStart(4, "0")}`,
  ownerKey: overrides.ownerKey ?? `BAND:${seq}`,
  createdAt: overrides.createdAt ?? NOW,
  likes: overrides.likes ?? 0,
  comments: overrides.comments ?? 0,
  signals: {
    local: false,
    followedOwner: false,
    followedScene: false,
    genreMatch: false,
    ...overrides.signals,
  },
});

describe("scorePost", () => {
  it("weights a local post above a followed-owner post of the same age", () => {
    const local = scorePost(candidate({ signals: { local: true } as any }), NOW);
    const followed = scorePost(candidate({ signals: { followedOwner: true } as any }), NOW);
    expect(local).toBeGreaterThan(followed);
    expect(local - followed).toBeCloseTo(WEIGHTS.local - WEIGHTS.followedOwner);
  });

  it("adds signals together", () => {
    const both = scorePost(
      candidate({ signals: { local: true, genreMatch: true } as any }),
      NOW,
    );
    expect(both).toBeCloseTo(WEIGHTS.local + WEIGHTS.genreMatch);
  });

  it("decays with age", () => {
    const fresh = scorePost(candidate({ createdAt: NOW }), NOW);
    const old = scorePost(candidate({ createdAt: daysAgo(14) }), NOW);
    expect(fresh - old).toBeCloseTo(1);
  });

  it("never rewards a post dated in the future", () => {
    const future = scorePost(candidate({ createdAt: new Date(NOW.getTime() + 86_400_000) }), NOW);
    expect(future).toBe(scorePost(candidate({ createdAt: NOW }), NOW));
  });

  it("gives engagement a logarithmic bump, comments worth double", () => {
    const quiet = scorePost(candidate(), NOW);
    const liked = scorePost(candidate({ likes: 2 }), NOW);
    const discussed = scorePost(candidate({ comments: 1 }), NOW);
    expect(liked).toBeGreaterThan(quiet);
    expect(discussed).toBeCloseTo(liked);
  });
});

describe("rankPosts", () => {
  it("orders by score", () => {
    const global = candidate({ id: "global" });
    const local = candidate({ id: "local", signals: { local: true } as any });
    const stale = candidate({ id: "stale", createdAt: daysAgo(30) });
    const ranked = rankPosts([stale, global, local], NOW);
    expect(ranked.map(p => p.id)).toEqual(["local", "global", "stale"]);
  });

  it("breaks score ties on id so paging is deterministic", () => {
    const a = candidate({ id: "b-post" });
    const b = candidate({ id: "a-post" });
    const c = candidate({ id: "c-post" });
    const once = rankPosts([a, b, c], NOW).map(p => p.id);
    const again = rankPosts([c, a, b], NOW).map(p => p.id);
    expect(once).toEqual(["a-post", "b-post", "c-post"]);
    expect(again).toEqual(once);
  });

  it("merges a post found in several pools, OR-ing its signals", () => {
    const id = "shared";
    const fromLocal = candidate({ id, signals: { local: true } as any });
    const fromFollows = candidate({ id, signals: { followedOwner: true } as any });
    const other = candidate({ id: "other", signals: { local: true } as any });
    const stale = candidate({ id: "stale", createdAt: daysAgo(30) });

    const ranked = rankPosts([fromLocal, fromFollows, other, stale], NOW);
    expect(ranked.filter(p => p.id === id)).toHaveLength(1);
    expect(ranked.find(p => p.id === id)!.signals).toMatchObject({
      local: true,
      followedOwner: true,
    });
    // local + followed beats local alone.
    expect(ranked[0].id).toBe(id);
  });

  it("caps any one owner at two posts per block of nine", () => {
    // Ten top-scoring posts from one prolific owner, then eight others.
    const prolific = Array.from({ length: 10 }, (_, i) =>
      candidate({ id: `hot${i}`, ownerKey: "BAND:hot", signals: { local: true } as any }),
    );
    const others = Array.from({ length: 8 }, (_, i) =>
      candidate({ id: `cold${i}`, ownerKey: `USER:${i}` }),
    );

    const ranked = rankPosts([...prolific, ...others], NOW);
    const firstBlock = ranked.slice(0, 9);
    expect(firstBlock.filter(p => p.ownerKey === "BAND:hot")).toHaveLength(2);
    // Deferred posts are not dropped, just pushed later.
    expect(ranked.map(p => p.id).sort()).toEqual(
      [...prolific, ...others].map(p => p.id).sort(),
    );
  });

  it("relaxes the owner cap rather than leave a block short", () => {
    // Only one owner exists: blocks must still be full, or every later block
    // would be misaligned against the 9-wide grid.
    const solo = Array.from({ length: 9 }, (_, i) =>
      candidate({ id: `solo${i}`, ownerKey: "BAND:solo" }),
    );
    expect(rankPosts(solo, NOW)).toHaveLength(9);
  });

  it("trims to whole rows of three", () => {
    const seven = Array.from({ length: 7 }, () => candidate());
    expect(rankPosts(seven, NOW)).toHaveLength(6);
  });

  it("caps the ranked list", () => {
    const many = Array.from({ length: MAX_RANKED + 50 }, () => candidate());
    expect(rankPosts(many, NOW)).toHaveLength(MAX_RANKED);
  });
});
