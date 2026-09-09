import { describe, it, expect } from "vitest";
import {
  tokenizeGenreText,
  matchToken,
  matchGenreText,
  unmatchedTokens,
} from "../../src/lib/genreMatch";
import { GENRE_SEED } from "../../src/lib/genres.seed";

/** The seed list in the shape the matcher expects. No DB involved. */
const GENRES = GENRE_SEED.map(g => ({
  slug: g.slug,
  name: g.name,
  aliases: g.aliases ?? [],
}));

const slugs = (raw: string, limit?: number) =>
  matchGenreText(raw, GENRES, limit).map(g => g.slug);

describe("tokenizeGenreText", () => {
  it("splits on the separators that appear in real data", () => {
    expect(tokenizeGenreText("Indie Rock / Shoegaze")).toEqual(["indie rock", "shoegaze"]);
    expect(tokenizeGenreText("post-rock, math rock, emo")).toEqual([
      "post-rock",
      "math rock",
      "emo",
    ]);
  });

  it("keeps a single space inside a multi-word genre", () => {
    expect(tokenizeGenreText("indie rock")).toEqual(["indie rock"]);
  });

  it("does not split on 'and' or '&', which live inside real genre names", () => {
    // Splitting these eagerly would shred R&B and Drum & Bass into fragments
    // that match nothing. matchGenreText handles conjunctions as a fallback.
    expect(tokenizeGenreText("drum and bass")).toEqual(["drum and bass"]);
    expect(tokenizeGenreText("R&B")).toEqual(["r&b"]);
  });

  it("drops empty and single-character fragments", () => {
    expect(tokenizeGenreText("rock,,x, punk")).toEqual(["rock", "punk"]);
  });

  it("does not throw on an empty string", () => {
    expect(tokenizeGenreText("")).toEqual([]);
  });
});

describe("matchToken", () => {
  it("matches on slug, display name and alias", () => {
    expect(matchToken("shoegaze", GENRES)?.slug).toBe("shoegaze");
    expect(matchToken("Shoegaze", GENRES)?.slug).toBe("shoegaze");
    expect(matchToken("shoe gaze", GENRES)?.slug).toBe("shoegaze");
    expect(matchToken("nugaze", GENRES)?.slug).toBe("shoegaze");
  });

  it("ignores case and punctuation", () => {
    expect(matchToken("SHOEGAZE", GENRES)?.slug).toBe("shoegaze");
    expect(matchToken("Hip-Hop", GENRES)?.slug).toBe("hip-hop");
    expect(matchToken("hip hop", GENRES)?.slug).toBe("hip-hop");
    expect(matchToken("hiphop", GENRES)?.slug).toBe("hip-hop");
  });

  it("returns undefined rather than guessing", () => {
    expect(matchToken("aleatoric microtonal", GENRES)).toBeUndefined();
    expect(matchToken("", GENRES)).toBeUndefined();
  });
});

describe("matchGenreText", () => {
  it("resolves the labels the shipped genre chips send", () => {
    // Every chip in the frontend's hardcoded GENRES array must resolve, or
    // /bands?genre= breaks for existing clients.
    expect(slugs("Rock")).toEqual(["rock"]);
    expect(slugs("Metal")).toEqual(["metal"]);
    expect(slugs("Pop")).toEqual(["pop"]);
    expect(slugs("Hip-Hop")).toEqual(["hip-hop"]);
    expect(slugs("Jazz")).toEqual(["jazz"]);
    expect(slugs("Country")).toEqual(["country"]);
    expect(slugs("Electronic")).toEqual(["electronic"]);
    expect(slugs("Folk")).toEqual(["folk"]);
    expect(slugs("R&B")).toEqual(["soul-rnb"]);
    expect(slugs("Punk")).toEqual(["punk"]);
    expect(slugs("Indie")).toEqual(["indie-rock"]);
    expect(slugs("Blues")).toEqual(["blues"]);
    expect(slugs("Classical")).toEqual(["classical"]);
  });

  it("resolves multi-genre free text in order", () => {
    expect(slugs("Indie Rock / Shoegaze")).toEqual(["indie-rock", "shoegaze"]);
    expect(slugs("post-rock / emo")).toEqual(["post-rock", "emo"]);
  });

  it("prefers a whole-string match over splitting on a conjunction", () => {
    // These names contain "and"/"&" themselves.
    expect(slugs("drum and bass")).toEqual(["dnb"]);
    expect(slugs("Drum & Bass")).toEqual(["dnb"]);
    expect(slugs("rhythm and blues")).toEqual(["soul-rnb"]);
  });

  it("falls back to splitting a conjunction that is not part of a name", () => {
    expect(slugs("jazz and funk")).toEqual(["jazz", "funk"]);
    expect(slugs("punk & hardcore")).toEqual(["punk", "hardcore"]);
  });

  it("caps the result and de-duplicates", () => {
    expect(slugs("post-rock, math rock, emo, screamo")).toEqual([
      "post-rock",
      "math-rock",
      "emo",
    ]);
    expect(slugs("rock, Rock, ROCK")).toEqual(["rock"]);
    expect(slugs("punk, hardcore, emo, screamo", 2)).toEqual(["punk", "hardcore"]);
  });

  it("returns an empty list for unmatched text without throwing", () => {
    expect(slugs("aleatoric microtonal")).toEqual([]);
    expect(slugs("")).toEqual([]);
  });

  it("keeps punctuation-heavy input matchable", () => {
    expect(slugs("SHOEGAZE!!")).toEqual(["shoegaze"]);
  });
});

describe("unmatchedTokens", () => {
  it("reports only the tokens that resolved to nothing", () => {
    expect(unmatchedTokens("shoegaze, gamelan", GENRES)).toEqual(["gamelan"]);
    expect(unmatchedTokens("rock, punk", GENRES)).toEqual([]);
  });
});

describe("GENRE_SEED integrity", () => {
  it("has unique slugs", () => {
    const seen = new Set<string>();
    const dupes = GENRE_SEED.filter(g => (seen.has(g.slug) ? true : (seen.add(g.slug), false)));
    expect(dupes.map(d => d.slug)).toEqual([]);
  });

  it("only names parents that exist in the list", () => {
    const all = new Set(GENRE_SEED.map(g => g.slug));
    const orphans = GENRE_SEED.filter(g => g.parent && !all.has(g.parent));
    expect(orphans.map(o => `${o.slug} -> ${o.parent}`)).toEqual([]);
  });

  it("has no alias that collides with another genre's slug or name", () => {
    const collisions: string[] = [];
    for (const g of GENRE_SEED) {
      for (const alias of g.aliases ?? []) {
        const hit = matchToken(alias, GENRES);
        if (hit && hit.slug !== g.slug) collisions.push(`${g.slug}:"${alias}" -> ${hit.slug}`);
      }
    }
    expect(collisions).toEqual([]);
  });
});
