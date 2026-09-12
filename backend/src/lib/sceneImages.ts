import { prisma } from "./prisma";

/**
 * Scene imagery, borrowed from the scene's bands.
 *
 * A scene's avatar is the banner of its most-followed band, and its banner is
 * the banner of the second. Bands without a banner are skipped, so the picks are
 * "the two most-followed bands that have one". Each slot falls back on its own
 * to the scene's uploaded image, then to null (the client's placeholder).
 *
 * A genre facet ("Houston Shoegaze") applies the same rule to that genre's bands
 * within the scene.
 */

export type SceneImages = { imageUrl: string | null; headerImageUrl: string | null };

type OwnImages = { id: string; imageUrl?: string | null; headerImageUrl?: string | null };

type BannerBand = {
  id: string;
  headerImageUrl: string;
  genreIds: string[];
  followers: number;
  createdAt: Date;
};

/** Most followers first; ties go to the older band, then id, so a pick is stable. */
const byPopularity = (a: BannerBand, b: BannerBand) =>
  b.followers - a.followers ||
  a.createdAt.getTime() - b.createdAt.getTime() ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const pick = (ranked: BannerBand[], own: OwnImages): SceneImages => ({
  imageUrl: ranked[0]?.headerImageUrl ?? own.imageUrl ?? null,
  headerImageUrl: ranked[1]?.headerImageUrl ?? own.headerImageUrl ?? null,
});

/**
 * Bannered bands per scene, most popular first. Two queries for any number of
 * scenes -- the bands, then one groupBy for their follower counts -- so a page of
 * scenes never costs a query per row.
 */
const bannerBandsByScene = async (sceneIds: string[]) => {
  const byScene = new Map<string, BannerBand[]>();
  if (sceneIds.length === 0) return byScene;

  const bands = await prisma.band.findMany({
    where: { sceneId: { in: sceneIds }, deletedAt: null, headerImageUrl: { not: null } },
    select: {
      id: true,
      sceneId: true,
      headerImageUrl: true,
      createdAt: true,
      genres: { select: { genreId: true } },
    },
  });
  if (bands.length === 0) return byScene;

  const counts = await prisma.follow.groupBy({
    by: ["followeeBandId"],
    where: { followeeBandId: { in: bands.map(b => b.id) } },
    _count: { _all: true },
  });
  const followers = new Map(counts.map(c => [c.followeeBandId!, c._count._all]));

  for (const b of bands) {
    const list = byScene.get(b.sceneId!) ?? [];
    list.push({
      id: b.id,
      headerImageUrl: b.headerImageUrl!,
      genreIds: b.genres.map(g => g.genreId),
      followers: followers.get(b.id) ?? 0,
      createdAt: b.createdAt,
    });
    byScene.set(b.sceneId!, list);
  }
  for (const list of byScene.values()) list.sort(byPopularity);

  return byScene;
};

/** Avatar and banner for each scene, keyed by scene id. */
export const imagesForScenes = async (scenes: OwnImages[]): Promise<Map<string, SceneImages>> => {
  const byScene = await bannerBandsByScene(scenes.map(s => s.id));
  return new Map(scenes.map(s => [s.id, pick(byScene.get(s.id) ?? [], s)]));
};

/** One scene's images, plus one set per genre facet, from a single fetch. */
export const imagesForScene = async (scene: OwnImages, genreIds: string[]) => {
  const ranked = (await bannerBandsByScene([scene.id])).get(scene.id) ?? [];
  return {
    scene: pick(ranked, scene),
    byGenre: new Map(
      genreIds.map(id => [id, pick(ranked.filter(b => b.genreIds.includes(id)), scene)]),
    ),
  };
};
