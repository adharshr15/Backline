import { Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { canActAsLower } from "../lib/authorization";
import { Craft } from "../../generated/prisma/enums";
import {
  stateSpellings,
  boundingBox,
  haversineKm,
  countsForScenes,
} from "../lib/scenes";
import { clampLimit, parseText, parseNumber } from "../lib/query";

/**
 * GET /explore
 *
 * The Explore feed: a list of named sections for the acting profile's area.
 *
 * The response is a LIST of section descriptors rather than a fixed object, so
 * the client renders sections.map(...) and knows nothing about which sections
 * exist. Adding "Texas Shoegaze" later is then a backend-only change.
 *
 * Each item carries { id, name, subtitle, profileImageUrl, accountType } -- the
 * exact shape the shipped DiscoverSection already binds to. Everything else on an
 * item is additive.
 *
 * Query budget is ~14, all indexed, all parallel within their stage. Keep it that
 * way: no per-item lookups.
 */

const MAX_SECTIONS = 8;
const MAX_ITEMS = 20;
/** Guards the fan-out when a profile follows thousands of bands. */
const FOLLOW_SAMPLE = 200;
const GENRE_SECTIONS = 2;

type ProfileType = "user" | "band" | "venue";

type Item = {
  id: string;
  type: "SHOW" | "BAND" | "VENUE" | "USER" | "SCENE";
  accountType: string | null;
  name: string;
  subtitle: string;
  profileImageUrl: string | null;
  [key: string]: unknown;
};

type Section = {
  key: string;
  title: string;
  kind: "SHOW" | "PROFILE" | "SCENE";
  seeMore: { path: string; params: Record<string, string> };
  items: Item[];
};

const placeLabel = (city?: string | null, state?: string | null) =>
  city && state ? `${city}, ${state}` : city || state || "";

const craftLabel = (craft: string) =>
  craft
    .toLowerCase()
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const showDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const getExplore = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const profileTypeRaw = (req.query.profileType as string) ?? "user";
    if (!["user", "band", "venue"].includes(profileTypeRaw)) {
      return res.status(400).json({ error: "Invalid profileType" });
    }
    const profileType = profileTypeRaw as ProfileType;

    const profileId = parseText(req.query.profileId, 64) ?? userId;

    // profileId is a caller-supplied profile id, so it goes through the
    // authorization checklist. Without this, anyone could enumerate any band's
    // follow graph by reading its personalized genre sections.
    if (!(await canActAsLower(userId, profileType, profileId))) {
      return res.status(403).json({ error: "You cannot browse as this profile" });
    }

    const limit = clampLimit(req.query.limit, 10, MAX_ITEMS);

    const city = parseText(req.query.city);
    const state = parseText(req.query.state);
    if ((req.query.city !== undefined) !== (req.query.state !== undefined)) {
      return res.status(400).json({ error: "city and state must be supplied together" });
    }

    const hasLat = req.query.lat !== undefined;
    const hasLng = req.query.lng !== undefined;
    if (hasLat !== hasLng) {
      return res.status(400).json({ error: "lat and lng must be supplied together" });
    }
    const lat = parseNumber(req.query.lat, -90, 90);
    const lng = parseNumber(req.query.lng, -180, 180);
    if (hasLat && (lat === undefined || lng === undefined)) {
      return res.status(400).json({ error: "lat and lng must be valid coordinates" });
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
    let scenes: { id: string; slug: string; name: string; city: string; state: string; country: string }[] = [];
    let source: "query" | "coords" | "profile" | null = null;

    const sceneSelect = {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      country: true,
    } as const;

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
    const hasLocation = sceneIds.length > 0;

    const location = primary
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

    // ---- Sections -------------------------------------------------------
    const sections: Section[] = [];

    if (hasLocation && primary) {
      const locParams = { city: primary.city, state: primary.state };

      const [shows, bands, venues, people] = await Promise.all([
        prisma.show.findMany({
          where: {
            sceneId: { in: sceneIds },
            deletedAt: null,
            date: { gte: new Date() },
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            date: true,
            city: true,
            state: true,
            posterUrl: true,
            venueName: true,
            sceneId: true,
            venue: { select: { name: true } },
          },
          orderBy: { date: "asc" },
          take: limit,
        }),

        prisma.band.findMany({
          where: {
            sceneId: { in: sceneIds },
            deletedAt: null,
            // Do not show the acting band itself back to itself.
            ...(profileType === "band" ? { id: { not: profileId } } : {}),
          },
          select: {
            id: true,
            name: true,
            genre: true,
            city: true,
            state: true,
            profileImageUrl: true,
            accountType: true,
            genres: {
              select: { genre: { select: { slug: true, name: true } } },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),

        prisma.venue.findMany({
          where: {
            sceneId: { in: sceneIds },
            deletedAt: null,
            ...(profileType === "venue" ? { id: { not: profileId } } : {}),
          },
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            profileImageUrl: true,
            accountType: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),

        prisma.user.findMany({
          where: {
            sceneId: { in: sceneIds },
            deletedAt: null,
            crafts: {
              some: {
                craft: {
                  in: [
                    Craft.PHOTOGRAPHER,
                    Craft.PROMOTER,
                    Craft.SOUND_ENGINEER,
                    Craft.VIDEOGRAPHER,
                  ],
                },
              },
            },
          },
          // select, never include: include on a User returns the password hash.
          select: {
            id: true,
            username: true,
            name: true,
            city: true,
            state: true,
            profileImageUrl: true,
            accountType: true,
            crafts: {
              select: { craft: true, forHire: true, headline: true },
              orderBy: { position: "asc" },
            },
          },
          take: limit,
        }),
      ]);

      if (shows.length) {
        sections.push({
          key: "shows_near_you",
          title: "Shows Near You",
          kind: "SHOW",
          seeMore: { path: "/shows", params: locParams },
          items: shows.map(s => ({
            id: s.id,
            type: "SHOW",
            accountType: null,
            name: s.venue?.name ?? s.venueName ?? s.city,
            subtitle: `${showDateLabel(s.date)} · ${placeLabel(s.city, s.state)}`,
            profileImageUrl: s.posterUrl,
            date: s.date,
            city: s.city,
            state: s.state,
            venueName: s.venue?.name ?? s.venueName,
            sceneSlug: scenes.find(sc => sc.id === s.sceneId)?.slug ?? primary.slug,
          })),
        });
      }

      if (bands.length) {
        sections.push({
          key: "bands_near_you",
          title: "Bands Near You",
          kind: "PROFILE",
          seeMore: { path: "/bands", params: locParams },
          items: bands.map(b => {
            const genres = b.genres.map(g => g.genre);
            const label = genres[0]?.name ?? b.genre ?? "Band";
            return {
              id: b.id,
              type: "BAND" as const,
              accountType: b.accountType as string,
              name: b.name,
              subtitle: `${label} · ${placeLabel(b.city, b.state)}`,
              profileImageUrl: b.profileImageUrl,
              city: b.city,
              state: b.state,
              genres,
            };
          }),
        });
      }

      if (venues.length) {
        sections.push({
          key: "venues_near_you",
          title: `Venues in ${primary.name}`,
          kind: "PROFILE",
          seeMore: { path: "/venues", params: locParams },
          items: venues.map(v => ({
            id: v.id,
            type: "VENUE" as const,
            accountType: v.accountType as string,
            name: v.name,
            subtitle: placeLabel(v.city, v.state),
            profileImageUrl: v.profileImageUrl,
            city: v.city,
            state: v.state,
          })),
        });
      }

      // Genre facets: "Houston Shoegaze". These are the sub-scenes, expressed as
      // a (scene, genre) query rather than as rows anywhere.
      for (const genre of topGenres.slice(0, GENRE_SECTIONS)) {
        if (sections.length >= MAX_SECTIONS - 1) break;

        const genreBands = await prisma.band.findMany({
          where: {
            sceneId: { in: sceneIds },
            deletedAt: null,
            genres: { some: { genreId: genre.id } },
            ...(profileType === "band" ? { id: { not: profileId } } : {}),
          },
          select: {
            id: true,
            name: true,
            genre: true,
            city: true,
            state: true,
            profileImageUrl: true,
            accountType: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        if (!genreBands.length) continue;

        sections.push({
          key: `genre:${genre.slug}`,
          title: `${primary.name} ${genre.name}`,
          kind: "PROFILE",
          seeMore: {
            path: `/scenes/${primary.slug}/bands`,
            params: { genre: genre.slug },
          },
          items: genreBands.map(b => ({
            id: b.id,
            type: "BAND" as const,
            accountType: b.accountType as string,
            name: b.name,
            subtitle: `${genre.name} · ${placeLabel(b.city, b.state)}`,
            profileImageUrl: b.profileImageUrl,
            city: b.city,
            state: b.state,
            genres: [{ slug: genre.slug, name: genre.name }],
          })),
        });
      }

      if (people.length) {
        sections.push({
          key: "people_near_you",
          title: "Photographers & Promoters Nearby",
          kind: "PROFILE",
          seeMore: { path: "/users/discover", params: { sceneSlug: primary.slug } },
          items: people.map(p => ({
            id: p.id,
            type: "USER" as const,
            accountType: p.accountType as string,
            name: p.name,
            subtitle: p.crafts.length
              ? `${craftLabel(p.crafts[0].craft)}${p.crafts.some(c => c.forHire) ? " · For hire" : ""}`
              : `@${p.username}`,
            profileImageUrl: p.profileImageUrl,
            city: p.city,
            state: p.state,
            crafts: p.crafts,
          })),
        });
      }
    }

    // Scenes to follow is not location-dependent, so it survives a profile with
    // no city at all -- the one section that can always render.
    if (sections.length < MAX_SECTIONS) {
      const candidates = await prisma.scene.findMany({
        where: {
          deletedAt: null,
          id: { notIn: [...followedSceneIds, ...sceneIds] },
        },
        select: { id: true, slug: true, name: true, city: true, state: true, imageUrl: true },
        take: limit,
      });

      if (candidates.length) {
        const counts = await countsForScenes(candidates.map(c => c.id));

        sections.push({
          key: "scenes_for_you",
          title: "Scenes to Follow",
          kind: "SCENE",
          seeMore: { path: "/scenes", params: {} },
          items: candidates.map(s => {
            const c = counts.get(s.id)!;
            return {
              id: s.id,
              type: "SCENE" as const,
              accountType: null,
              name: s.name,
              subtitle: `${c.bands} bands · ${c.venues} venues`,
              profileImageUrl: s.imageUrl,
              slug: s.slug,
              city: s.city,
              state: s.state,
              counts: c,
            };
          }),
        });
      }
    }

    res.json({ location, sections: sections.slice(0, MAX_SECTIONS) });
  } catch (error: any) {
    fail(res, error, "explore");
  }
};

/**
 * The genres to build facet sections from.
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
