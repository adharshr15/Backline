import { prisma } from "./prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { canActAsLower } from "./authorization";
import { stateSpellings, boundingBox, haversineKm } from "./scenes";
import { parseText, parseNumber } from "./query";

/**
 * Who is browsing, and where. Shared by GET /explore and GET /explore/posts so
 * the acting-as check and the location rules live in one place -- two copies
 * would eventually drift, and the drifted one would be the unchecked one.
 */

/** Guards the fan-out when a profile follows thousands of bands. */
export const FOLLOW_SAMPLE = 200;
export const GENRE_SECTIONS = 2;

export type ProfileType = "user" | "band" | "venue";

export type ExploreScene = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  country: string;
};

export type ExploreLocation = {
  city: string;
  state: string;
  country: string;
  scene: { id: string; slug: string; name: string };
  source: "query" | "coords" | "profile" | null;
};

export type ExploreContext = {
  profileType: ProfileType;
  profileId: string;
  scenes: ExploreScene[];
  sceneIds: string[];
  primary: ExploreScene | null;
  location: ExploreLocation | null;
  followedSceneIds: string[];
  topGenres: { id: string; slug: string; name: string }[];
};

export type ExploreContextResult =
  | { ok: true; ctx: ExploreContext }
  | { ok: false; status: 400 | 401 | 403; error: string };

const sceneSelect = {
  id: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  country: true,
} as const;

export const resolveExploreContext = async (req: AuthRequest): Promise<ExploreContextResult> => {
  const userId = req.user?.userId;
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };

  const profileTypeRaw = (req.query.profileType as string) ?? "user";
  if (!["user", "band", "venue"].includes(profileTypeRaw)) {
    return { ok: false, status: 400, error: "Invalid profileType" };
  }
  const profileType = profileTypeRaw as ProfileType;

  const profileId = parseText(req.query.profileId, 64) ?? userId;

  // profileId is a caller-supplied profile id, so it goes through the
  // authorization checklist. Without this, anyone could enumerate any band's
  // follow graph by reading its personalized sections.
  if (!(await canActAsLower(userId, profileType, profileId))) {
    return { ok: false, status: 403, error: "You cannot browse as this profile" };
  }

  const city = parseText(req.query.city);
  const state = parseText(req.query.state);
  if ((req.query.city !== undefined) !== (req.query.state !== undefined)) {
    return { ok: false, status: 400, error: "city and state must be supplied together" };
  }

  const hasLat = req.query.lat !== undefined;
  const hasLng = req.query.lng !== undefined;
  if (hasLat !== hasLng) {
    return { ok: false, status: 400, error: "lat and lng must be supplied together" };
  }
  const lat = parseNumber(req.query.lat, -90, 90);
  const lng = parseNumber(req.query.lng, -180, 180);
  if (hasLat && (lat === undefined || lng === undefined)) {
    return { ok: false, status: 400, error: "lat and lng must be valid coordinates" };
  }
  const radiusKm = parseNumber(req.query.radiusKm, 1, 250) ?? 50;

  // ---- Acting profile -------------------------------------------------
  const actingProfile =
    profileType === "band"
      ? await prisma.band.findUnique({
          where: { id: profileId },
          select: { id: true, city: true, state: true, sceneId: true },
        })
      : profileType === "venue"
        ? await prisma.venue.findUnique({
            where: { id: profileId },
            select: { id: true, city: true, state: true, sceneId: true },
          })
        : await prisma.user.findUnique({
            where: { id: profileId },
            select: { id: true, city: true, state: true, sceneId: true },
          });

  // ---- Location resolution -------------------------------------------
  // Explicit city/state -> coordinates -> the acting profile's scene -> its
  // city/state -> nothing. When nothing resolves, location-dependent sections
  // are omitted entirely rather than returned empty, so the client never
  // renders an empty "Shows Near You" rail.
  let scenes: ExploreScene[] = [];
  let source: ExploreLocation["source"] = null;

  if (city && state) {
    const found = await prisma.scene.findFirst({
      where: {
        deletedAt: null,
        city: { equals: city, mode: "insensitive" },
        state: { in: stateSpellings(state), mode: "insensitive" },
      },
      select: sceneSelect,
    });
    if (found) {
      scenes = [found];
      source = "query";
    }
  } else if (lat !== undefined && lng !== undefined) {
    const box = boundingBox(lat, lng, radiusKm);
    const nearby = await prisma.scene.findMany({
      where: {
        deletedAt: null,
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      },
      select: { ...sceneSelect, latitude: true, longitude: true },
      take: FOLLOW_SAMPLE,
    });

    scenes = nearby
      .map(s => ({
        ...s,
        distanceKm: haversineKm(lat, lng, s.latitude!, s.longitude!),
      }))
      .filter(s => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (scenes.length) source = "coords";
  }

  if (!source && actingProfile?.sceneId) {
    const own = await prisma.scene.findUnique({
      where: { id: actingProfile.sceneId },
      select: sceneSelect,
    });
    if (own) {
      scenes = [own];
      source = "profile";
    }
  }

  if (!source && actingProfile?.city && actingProfile.state) {
    const found = await prisma.scene.findFirst({
      where: {
        deletedAt: null,
        city: { equals: actingProfile.city, mode: "insensitive" },
        state: { in: stateSpellings(actingProfile.state), mode: "insensitive" },
      },
      select: sceneSelect,
    });
    if (found) {
      scenes = [found];
      source = "profile";
    }
  }

  const sceneIds = scenes.map(s => s.id);
  const primary = scenes[0] ?? null;

  const location: ExploreLocation | null = primary
    ? {
        city: primary.city,
        state: primary.state,
        country: primary.country,
        scene: { id: primary.id, slug: primary.slug, name: primary.name },
        source,
      }
    : null;

  // ---- Followed scenes and top genres ---------------------------------
  const followedScenes = await prisma.sceneFollow.findMany({
    where: { followerId: profileId, followerType: profileType },
    select: { sceneId: true },
    take: FOLLOW_SAMPLE,
  });
  const followedSceneIds = followedScenes.map(f => f.sceneId);

  const topGenres = await resolveTopGenres(profileType, profileId);

  return {
    ok: true,
    ctx: {
      profileType,
      profileId,
      scenes,
      sceneIds,
      primary,
      location,
      followedSceneIds,
      topGenres,
    },
  };
};

/**
 * The genres to personalize by.
 *
 * A band uses its own. A user or venue uses the genres of the bands it follows,
 * sampled rather than fully scanned -- a profile following 5000 bands must not
 * produce a 5000-element IN clause.
 */
const resolveTopGenres = async (profileType: ProfileType, profileId: string) => {
  if (profileType === "band") {
    const own = await prisma.bandGenre.findMany({
      where: { bandId: profileId },
      orderBy: { position: "asc" },
      take: GENRE_SECTIONS,
      select: { genre: { select: { id: true, slug: true, name: true } } },
    });
    return own.map(g => g.genre);
  }

  const followerKey =
    profileType === "venue" ? { followerVenueId: profileId } : { followerUserId: profileId };

  const follows = await prisma.follow.findMany({
    where: { ...followerKey, followeeType: "BAND" },
    select: { followeeBandId: true },
    take: FOLLOW_SAMPLE,
  });

  const bandIds = follows.flatMap(f => (f.followeeBandId ? [f.followeeBandId] : []));
  if (bandIds.length === 0) return [];

  const grouped = await prisma.bandGenre.groupBy({
    by: ["genreId"],
    where: { bandId: { in: bandIds } },
    _count: { _all: true },
    orderBy: { _count: { genreId: "desc" } },
    take: GENRE_SECTIONS,
  });

  if (grouped.length === 0) return [];

  const genres = await prisma.genre.findMany({
    where: { id: { in: grouped.map(g => g.genreId) } },
    select: { id: true, slug: true, name: true },
  });

  // Preserve the popularity ordering the groupBy established.
  const byId = new Map(genres.map(g => [g.id, g]));
  return grouped.flatMap(g => {
    const genre = byId.get(g.genreId);
    return genre ? [genre] : [];
  });
};
