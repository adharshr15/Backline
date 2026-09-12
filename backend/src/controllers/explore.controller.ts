import { Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { Craft } from "../../generated/prisma/enums";
import { countsForScenes } from "../lib/scenes";
import { imagesForScenes } from "../lib/sceneImages";
import { clampLimit } from "../lib/query";
import { resolveExploreContext, ExploreContext } from "../lib/exploreContext";
import { rankExplorePosts, toPostItem } from "../lib/explorePosts";
import { BLOCK_SIZE } from "../lib/postRanking";
import { decodeCursor, encodeCursor, ExploreCursor } from "../lib/exploreCursor";

/**
 * GET /explore
 *
 * The Explore feed: a list of named sections for the acting profile's area.
 *
 * The response is a LIST of section descriptors rather than a fixed object, so
 * the client renders sections.map(...) and knows nothing about which sections
 * exist. Adding "Texas Shoegaze" later is then a backend-only change.
 *
 * Rails (shows, bands, venues, ...) alternate with 3x3 grids of ranked posts
 * (kind "POSTS"). `postsCursor` continues the posts past the last rail via
 * GET /explore/posts.
 *
 * Each item carries { id, name, subtitle, profileImageUrl, accountType } -- the
 * exact shape the shipped DiscoverSection already binds to. Everything else on an
 * item is additive.
 *
 * Query budget is ~20, all indexed, all parallel within their stage. Keep it that
 * way: no per-item lookups.
 */

/** Caps rails. Post grids sit between rails and are not counted. */
const MAX_SECTIONS = 8;
const MAX_ITEMS = 20;
/** Posts per /explore/posts page: at most three grids. */
const MAX_POST_PAGE = 3 * BLOCK_SIZE;

type Item = {
  id: string;
  type: "SHOW" | "BAND" | "VENUE" | "USER" | "SCENE" | "POST";
  accountType: string | null;
  name: string;
  subtitle: string;
  profileImageUrl: string | null;
  [key: string]: unknown;
};

type Section = {
  key: string;
  title: string;
  kind: "SHOW" | "PROFILE" | "SCENE" | "POSTS";
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
    const result = await resolveExploreContext(req);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    const { ctx } = result;

    const limit = clampLimit(req.query.limit, 10, MAX_ITEMS);
    const asOf = new Date();

    const [rails, ranked] = await Promise.all([
      buildRails(ctx, limit),
      rankExplorePosts(ctx, asOf),
    ]);
    const { sections, consumed } = interleavePosts(rails, ranked.map(toPostItem));

    res.json({
      location: ctx.location,
      sections,
      postsCursor: consumed < ranked.length ? encodeCursor({ asOf, offset: consumed }) : null,
    });
  } catch (error: any) {
    fail(res, error, "explore");
  }
};

/**
 * GET /explore/posts?cursor
 *
 * More ranked posts, past the grids /explore embedded. Takes the same
 * profile and location params as /explore; without a cursor it starts from the
 * top of a fresh ranking.
 */
export const getExplorePosts = async (req: AuthRequest, res: Response) => {
  try {
    // Context first: an impersonation attempt is a 403 whatever the cursor says.
    const result = await resolveExploreContext(req);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    const { ctx } = result;

    let cursor: ExploreCursor = { asOf: new Date(), offset: 0 };
    if (req.query.cursor !== undefined) {
      const decoded = decodeCursor(req.query.cursor);
      if (!decoded) return res.status(400).json({ error: "Invalid cursor" });
      cursor = decoded;
    }

    // Whole grids only, so the client never renders a ragged block mid-feed.
    const blocks = Math.floor(clampLimit(req.query.limit, 2 * BLOCK_SIZE, MAX_POST_PAGE) / BLOCK_SIZE);
    const limit = Math.max(1, blocks) * BLOCK_SIZE;

    const ranked = await rankExplorePosts(ctx, cursor.asOf);
    const page = ranked.slice(cursor.offset, cursor.offset + limit);
    const next = cursor.offset + page.length;

    res.json({
      items: page.map(toPostItem),
      nextCursor: next < ranked.length ? encodeCursor({ asOf: cursor.asOf, offset: next }) : null,
    });
  } catch (error: any) {
    fail(res, error, "explore");
  }
};

/**
 * A 3x3 grid after every rail, until the ranked posts run out. With no rails at
 * all the posts still get one grid, so the page is not empty while there is
 * something to show.
 */
const interleavePosts = (rails: Section[], posts: Item[]) => {
  const sections: Section[] = [];
  let consumed = 0;
  let blockNo = 0;

  const pushBlock = () => {
    const items = posts.slice(consumed, consumed + BLOCK_SIZE);
    if (!items.length) return;
    consumed += items.length;
    sections.push({
      key: `posts:${++blockNo}`,
      title: "",
      kind: "POSTS",
      seeMore: { path: "/explore/posts", params: {} },
      items,
    });
  };

  for (const rail of rails) {
    sections.push(rail);
    pushBlock();
  }
  if (!rails.length) pushBlock();

  return { sections, consumed };
};

const buildRails = async (ctx: ExploreContext, limit: number): Promise<Section[]> => {
  const { profileType, profileId, scenes, sceneIds, primary, followedSceneIds, topGenres } = ctx;
  const sections: Section[] = [];

  if (sceneIds.length && primary) {
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
          const label = genres[0]?.name ?? "Band";
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
    for (const genre of topGenres) {
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
  // no city at all -- the one rail that can always render.
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
      const [counts, images] = await Promise.all([
        countsForScenes(candidates.map(c => c.id)),
        imagesForScenes(candidates),
      ]);

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
            profileImageUrl: images.get(s.id)!.imageUrl,
            slug: s.slug,
            city: s.city,
            state: s.state,
            counts: c,
          };
        }),
      });
    }
  }

  return sections.slice(0, MAX_SECTIONS);
};
