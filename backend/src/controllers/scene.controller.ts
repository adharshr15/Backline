import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { canActAsLower } from "../lib/authorization";
import { resolveScene, stateSpellings, boundingBox, haversineKm } from "../lib/scenes";
import { Craft } from "../../generated/prisma/enums";
import {
    clampLimit,
    parsePage,
    parseCsv,
    parseBool,
    parseText,
    parseNumber,
    paginated,
    isDateRange,
    dateRangeWindow,
} from "../lib/query";

/** Look up a scene by location without creating one. */
const findSceneByLocation = (city: string, state: string) =>
    prisma.scene.findFirst({
        where: {
            city: { equals: city, mode: "insensitive" },
            state: { in: stateSpellings(state), mode: "insensitive" },
        },
    });

const sceneSummarySelect = {
    id: true,
    slug: true,
    name: true,
    city: true,
    state: true,
    country: true,
    latitude: true,
    longitude: true,
    imageUrl: true,
    isCurated: true,
} as const;

type SceneCounts = { bands: number; venues: number; upcomingShows: number; followers: number };

/**
 * Counts for a page of scenes in four queries, independent of page size.
 *
 * Deliberately not Prisma's per-row `_count` on bands/venues/shows: that emits a
 * correlated subquery per relation per row, i.e. 3 x 100 subqueries for a full
 * page. A groupBy over the page's ids is one query each.
 */
const countsForScenes = async (sceneIds: string[]): Promise<Map<string, SceneCounts>> => {
    const empty = (): SceneCounts => ({ bands: 0, venues: 0, upcomingShows: 0, followers: 0 });
    const out = new Map(sceneIds.map(id => [id, empty()]));
    if (sceneIds.length === 0) return out;

    const inPage = { in: sceneIds };
    const [bands, venues, shows, follows] = await Promise.all([
        prisma.band.groupBy({
            by: ["sceneId"],
            where: { sceneId: inPage, deletedAt: null },
            _count: { _all: true },
        }),
        prisma.venue.groupBy({
            by: ["sceneId"],
            where: { sceneId: inPage, deletedAt: null },
            _count: { _all: true },
        }),
        prisma.show.groupBy({
            by: ["sceneId"],
            where: {
                sceneId: inPage,
                deletedAt: null,
                date: { gte: new Date() },
                status: { not: "CANCELLED" },
            },
            _count: { _all: true },
        }),
        prisma.sceneFollow.groupBy({
            by: ["sceneId"],
            where: { sceneId: inPage },
            _count: { _all: true },
        }),
    ]);

    for (const row of bands) if (row.sceneId) out.get(row.sceneId)!.bands = row._count._all;
    for (const row of venues) if (row.sceneId) out.get(row.sceneId)!.venues = row._count._all;
    for (const row of shows) if (row.sceneId) out.get(row.sceneId)!.upcomingShows = row._count._all;
    for (const row of follows) out.get(row.sceneId)!.followers = row._count._all;

    return out;
};

/** Resolve genre slugs, display names or aliases to Genre ids. */
const resolveGenreIds = async (tokens: string[]): Promise<string[]> => {
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

/** The scene named by :slug, or null. */
const sceneBySlug = (slug: string) =>
    prisma.scene.findFirst({ where: { slug, deletedAt: null } });

/** Compact scene reference returned alongside follow/unfollow. */
const sceneRef = (s: { id: string; slug: string; name: string; city: string; state: string }) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    city: s.city,
    state: s.state,
});

export const followScene = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { sceneId, slug, city, state, country, followerId, followerType } = req.body as {
            sceneId?: string; slug?: string;
            city?: string; state?: string; country?: string;
            followerId: string; followerType: string;
        };

        if (!sceneId && !slug && !(city && state)) {
            return res.status(400).json({ error: "sceneId, slug, or city and state are required" });
        }

        // Authorization before any write, and before creating a scene as a side
        // effect -- a caller who may not act as this profile should not be able to
        // bring scenes into existence either.
        if (!(await canActAsLower(userId, followerType, followerId))) {
            return res.status(403).json({ error: "You cannot follow scenes as this profile" });
        }

        // An explicit id or slug must exist. Only the city/state form creates,
        // because the shipped app follows a city that may have nothing in it yet.
        let scene = null;
        if (sceneId) {
            scene = await prisma.scene.findFirst({ where: { id: sceneId, deletedAt: null } });
        } else if (slug) {
            scene = await sceneBySlug(slug);
        } else {
            scene = await resolveScene({ city, state, country });
        }

        if (!scene) return res.status(404).json({ error: "Not found" });

        await prisma.sceneFollow.upsert({
            where: {
                followerId_followerType_sceneId: { followerId, followerType, sceneId: scene.id },
            },
            create: {
                sceneId: scene.id,
                followerId,
                followerType,
                city: scene.city,
                state: scene.state,
                country: scene.country,
            },
            update: {},
        });

        // `scene` is additive -- the shipped client reads only the status.
        res.json({ success: true, scene: sceneRef(scene) });
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

export const unfollowScene = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { sceneId, slug, city, state, followerId, followerType } = req.body as {
            sceneId?: string; slug?: string;
            city?: string; state?: string;
            followerId: string; followerType: string;
        };

        if (!sceneId && !slug && !(city && state)) {
            return res.status(400).json({ error: "sceneId, slug, or city and state are required" });
        }

        // The inverse of follow needs the same check. Missing inverse checks have
        // been the most common authorization bug in this codebase.
        if (!(await canActAsLower(userId, followerType, followerId))) {
            return res.status(403).json({ error: "You cannot unfollow scenes as this profile" });
        }

        // Never creates: unfollowing a city nothing has heard of must not bring
        // that scene into existence.
        let scene = null;
        if (sceneId) {
            scene = await prisma.scene.findFirst({ where: { id: sceneId, deletedAt: null } });
        } else if (slug) {
            scene = await sceneBySlug(slug);
        } else if (city && state) {
            scene = await findSceneByLocation(city, state);
        }

        if (!scene) return res.status(404).json({ error: "Not found" });

        await prisma.sceneFollow.deleteMany({
            where: { followerId, followerType, sceneId: scene.id },
        });

        res.json({ success: true, scene: sceneRef(scene) });
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/**
 * GET /scenes/following?followerId=&followerType=
 *
 * Still returns a bare array with city and state at the top level of each row --
 * the shipped ScenePage does
 *   scenes.some(s => s.city.toLowerCase() === city.toLowerCase())
 * and that has to keep working. The values now come from the joined Scene rather
 * than the legacy columns, which is what makes the SceneFollow migration
 * invisible to the running app. `scene` is added additively.
 */
export const getFollowedScenes = async (req: Request, res: Response) => {
    try {
        const { followerId, followerType } = req.query as Record<string, string>;
        if (!followerId || !followerType) {
            return res.status(400).json({ error: "followerId and followerType required" });
        }

        // Was unbounded. A list endpoint without a cap is a bulk export.
        const limit = clampLimit(req.query.limit, 100, 200);

        const follows = await prisma.sceneFollow.findMany({
            where: { followerId, followerType },
            orderBy: { createdAt: "asc" },
            take: limit,
            select: {
                id: true,
                sceneId: true,
                followerId: true,
                followerType: true,
                createdAt: true,
                scene: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        city: true,
                        state: true,
                        country: true,
                        imageUrl: true,
                    },
                },
            },
        });

        res.json(
            follows.map(f => ({
                id: f.id,
                sceneId: f.sceneId,
                followerId: f.followerId,
                followerType: f.followerType,
                createdAt: f.createdAt,
                city: f.scene.city,
                state: f.scene.state,
                country: f.scene.country,
                scene: f.scene,
            })),
        );
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/**
 * GET /scenes/:slug/following?followerId=&followerType=
 *
 * A direct "am I following this?" check, so the frontend can stop fetching the
 * whole follow list and scanning it.
 */
export const getSceneFollowState = async (req: Request, res: Response) => {
    try {
        const { followerId, followerType } = req.query as Record<string, string>;
        if (!followerId || !followerType) {
            return res.status(400).json({ error: "followerId and followerType required" });
        }

        const scene = await sceneBySlug(req.params.slug as string);
        if (!scene) return res.status(404).json({ error: "Not found" });

        const follow = await prisma.sceneFollow.findFirst({
            where: { followerId, followerType, sceneId: scene.id },
            select: { id: true },
        });

        res.json({ isFollowing: follow !== null });
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/**
 * GET /scenes/cities
 *
 * @deprecated Use GET /scenes, which paginates and carries full counts.
 *
 * Reimplemented over Scene rather than the old venue groupBy, but the response
 * shape is unchanged so the shipped scene.service.ts::SceneCity keeps compiling.
 * `slug` is added additively.
 */
export const getSceneCities = async (_req: Request, res: Response) => {
    try {
        const scenes = await prisma.scene.findMany({
            where: { deletedAt: null, latitude: { not: null }, longitude: { not: null } },
            select: { id: true, slug: true, city: true, state: true, latitude: true, longitude: true },
        });

        const venueCounts = await prisma.venue.groupBy({
            by: ["sceneId"],
            where: { sceneId: { in: scenes.map(s => s.id) }, deletedAt: null },
            _count: { _all: true },
        });
        const countBySceneId = new Map(
            venueCounts.filter(v => v.sceneId).map(v => [v.sceneId!, v._count._all]),
        );

        res.json(
            scenes.map(s => ({
                city: s.city,
                state: s.state,
                lat: s.latitude!,
                lng: s.longitude!,
                venueCount: countBySceneId.get(s.id) ?? 0,
                slug: s.slug,
            })),
        );
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/**
 * GET /scenes
 *
 * Public. Scene discovery.
 *   ?q= name or city   ?state=  ?country=  ?curatedOnly=
 *   ?lat= &lng= &radiusKm=      bounding box on Scene, then exact haversine sort
 *   ?sort=activity|name|distance
 *   ?page= &limit=              limit clamped to 100
 */
export const getScenes = async (req: Request, res: Response) => {
    try {
        const q = parseText(req.query.q);
        const state = parseText(req.query.state);
        const country = parseText(req.query.country);
        const curatedOnly = parseBool(req.query.curatedOnly);
        const page = parsePage(req.query.page);
        const limit = clampLimit(req.query.limit);

        const lat = parseNumber(req.query.lat, -90, 90);
        const lng = parseNumber(req.query.lng, -180, 180);
        const radiusKm = parseNumber(req.query.radiusKm, 1, 250) ?? 50;

        if ((req.query.lat !== undefined) !== (req.query.lng !== undefined)) {
            return res.status(400).json({ error: "lat and lng must be supplied together" });
        }
        if (req.query.lat !== undefined && (lat === undefined || lng === undefined)) {
            return res.status(400).json({ error: "lat and lng must be valid coordinates" });
        }

        const sort = (req.query.sort as string) ?? "activity";
        if (!["activity", "name", "distance"].includes(sort)) {
            return res.status(400).json({ error: "Invalid sort" });
        }
        if (sort === "distance" && (lat === undefined || lng === undefined)) {
            return res.status(400).json({ error: "sort=distance requires lat and lng" });
        }

        const where: any = { deletedAt: null };
        if (state) where.state = { in: stateSpellings(state), mode: "insensitive" };
        if (country) where.country = { equals: country, mode: "insensitive" };
        if (curatedOnly) where.isCurated = true;
        if (q) {
            where.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
            ];
        }
        if (lat !== undefined && lng !== undefined) {
            const box = boundingBox(lat, lng, radiusKm);
            where.latitude = { gte: box.minLat, lte: box.maxLat };
            where.longitude = { gte: box.minLng, lte: box.maxLng };
        }

        // "activity" needs counts before it can order, so it is sorted in app code
        // over a bounded candidate set rather than in SQL.
        const sortsInMemory = sort === "activity" || sort === "distance";
        const CANDIDATE_CAP = 500;

        const skip: number = sortsInMemory ? 0 : (page - 1) * limit;
        const take: number = sortsInMemory ? CANDIDATE_CAP : limit;

        const rows = await prisma.scene.findMany({
            where,
            select: sceneSummarySelect,
            orderBy: sort === "name" ? { name: "asc" } : { createdAt: "asc" },
            skip,
            take,
        });

        const counts = await countsForScenes(rows.map(r => r.id));

        let scenes = rows.map(r => ({
            ...r,
            counts: counts.get(r.id)!,
            ...(lat !== undefined && lng !== undefined && r.latitude != null && r.longitude != null
                ? { distanceKm: Number(haversineKm(lat, lng, r.latitude, r.longitude).toFixed(1)) }
                : {}),
        }));

        if (sort === "distance") {
            scenes.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
        } else if (sort === "activity") {
            const score = (c: SceneCounts) => c.upcomingShows * 3 + c.bands + c.venues + c.followers;
            scenes.sort((a, b) => score(b.counts) - score(a.counts) || a.name.localeCompare(b.name));
        }

        if (sortsInMemory) {
            scenes = scenes.slice((page - 1) * limit, (page - 1) * limit + limit);
        }

        res.json({ scenes, page, limit, hasMore: scenes.length === limit });
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/** Everything a scene header needs, in one response. */
const sceneDetail = async (scene: { id: string }) => {
    const full = await prisma.scene.findUniqueOrThrow({
        where: { id: scene.id },
        select: { ...sceneSummarySelect, bio: true, headerImageUrl: true },
    });

    const [counts, people, topGenreRows] = await Promise.all([
        countsForScenes([full.id]),
        prisma.user.count({ where: { sceneId: full.id, deletedAt: null, crafts: { some: {} } } }),
        prisma.bandGenre.groupBy({
            by: ["genreId"],
            where: { band: { sceneId: full.id, deletedAt: null } },
            _count: { _all: true },
            orderBy: { _count: { genreId: "desc" } },
            take: 8,
        }),
    ]);

    const genres = await prisma.genre.findMany({
        where: { id: { in: topGenreRows.map(g => g.genreId) } },
        select: { id: true, slug: true, name: true },
    });
    const genreById = new Map(genres.map(g => [g.id, g]));

    return {
        ...full,
        counts: { ...counts.get(full.id)!, people },
        // These are the sub-scene chips: "Houston Shoegaze" is a facet of this
        // list, not a row anywhere.
        topGenres: topGenreRows.flatMap(row => {
            const g = genreById.get(row.genreId);
            return g ? [{ slug: g.slug, name: g.name, bandCount: row._count._all }] : [];
        }),
    };
};

/** GET /scenes/:slug — public. */
export const getSceneBySlug = async (req: Request, res: Response) => {
    try {
        const scene = await sceneBySlug(req.params.slug as string);
        if (!scene) return res.status(404).json({ error: "Not found" });

        res.json(await sceneDetail(scene));
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/**
 * GET /scenes/by-location?city=&state=
 *
 * Same payload as /scenes/:slug. Exists because the shipped ScenePage routes on
 * { city, state } params rather than a slug; the frontend can migrate at its
 * own pace.
 */
export const getSceneByLocation = async (req: Request, res: Response) => {
    try {
        const city = parseText(req.query.city);
        const state = parseText(req.query.state);
        if (!city || !state) {
            return res.status(400).json({ error: "city and state are required" });
        }

        const scene = await findSceneByLocation(city, state);
        if (!scene || scene.deletedAt) return res.status(404).json({ error: "Not found" });

        res.json(await sceneDetail(scene));
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/**
 * GET /scenes/:slug/bands?genre=<csv>&q=
 *
 * The "Houston Shoegaze" endpoint. An unresolvable genre yields no results
 * rather than a 400 -- a filter that rejects a typo is hostile.
 */
export const getSceneBands = async (req: Request, res: Response) => {
    try {
        const scene = await sceneBySlug(req.params.slug as string);
        if (!scene) return res.status(404).json({ error: "Not found" });

        const page = parsePage(req.query.page);
        const limit = clampLimit(req.query.limit);
        const q = parseText(req.query.q);
        const genreTokens = parseCsv(req.query.genre, 5);

        const where: any = { sceneId: scene.id, deletedAt: null };
        if (q) where.name = { contains: q, mode: "insensitive" };

        if (genreTokens.length) {
            const genreIds = await resolveGenreIds(genreTokens);
            if (genreIds.length === 0) return res.json(paginated([], page, limit));
            where.genres = { some: { genreId: { in: genreIds } } };
        }

        const bands = await prisma.band.findMany({
            where,
            select: {
                id: true,
                name: true,
                genre: true,
                city: true,
                state: true,
                profileImageUrl: true,
                accountType: true,
                genres: {
                    select: { position: true, genre: { select: { slug: true, name: true } } },
                    orderBy: { position: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });

        res.json(
            paginated(
                bands.map(b => ({ ...b, genres: b.genres.map(g => g.genre) })),
                page,
                limit,
            ),
        );
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/** GET /scenes/:slug/venues?minCapacity=&maxCapacity= */
export const getSceneVenues = async (req: Request, res: Response) => {
    try {
        const scene = await sceneBySlug(req.params.slug as string);
        if (!scene) return res.status(404).json({ error: "Not found" });

        const page = parsePage(req.query.page);
        const limit = clampLimit(req.query.limit);
        const q = parseText(req.query.q);
        const minCapacity = parseNumber(req.query.minCapacity, 0, 1_000_000);
        const maxCapacity = parseNumber(req.query.maxCapacity, 0, 1_000_000);

        const where: any = { sceneId: scene.id, deletedAt: null };
        if (q) where.name = { contains: q, mode: "insensitive" };
        if (minCapacity !== undefined || maxCapacity !== undefined) {
            where.capacity = {
                ...(minCapacity !== undefined ? { gte: minCapacity } : {}),
                ...(maxCapacity !== undefined ? { lte: maxCapacity } : {}),
            };
        }

        const venues = await prisma.venue.findMany({
            where,
            select: {
                id: true,
                name: true,
                city: true,
                state: true,
                capacity: true,
                latitude: true,
                longitude: true,
                profileImageUrl: true,
                accountType: true,
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });

        res.json(paginated(venues, page, limit));
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/** GET /scenes/:slug/people?craft=<csv>&forHire= */
export const getScenePeople = async (req: Request, res: Response) => {
    try {
        const scene = await sceneBySlug(req.params.slug as string);
        if (!scene) return res.status(404).json({ error: "Not found" });

        const page = parsePage(req.query.page);
        const limit = clampLimit(req.query.limit);
        const forHire = parseBool(req.query.forHire);
        const craftTokens = parseCsv(req.query.craft, 6);

        const valid = Object.values(Craft) as string[];
        const invalid = craftTokens.filter(c => !valid.includes(c.toUpperCase()));
        if (invalid.length) {
            return res.status(400).json({ error: `Invalid craft: ${invalid.join(", ")}` });
        }
        const crafts = craftTokens.map(c => c.toUpperCase() as Craft);

        const craftFilter: any = {};
        if (crafts.length) craftFilter.craft = { in: crafts };
        if (forHire !== undefined) craftFilter.forHire = forHire;

        const people = await prisma.user.findMany({
            where: {
                sceneId: scene.id,
                deletedAt: null,
                crafts: { some: Object.keys(craftFilter).length ? craftFilter : {} },
            },
            // select, never include: include on a User returns the password hash.
            select: {
                id: true,
                username: true,
                name: true,
                accountType: true,
                city: true,
                state: true,
                profileImageUrl: true,
                crafts: {
                    select: { craft: true, forHire: true, headline: true },
                    orderBy: { position: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });

        res.json(paginated(people, page, limit));
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

/** GET /scenes/:slug/shows?dateRange=&genre=<csv>&past= */
export const getSceneShows = async (req: Request, res: Response) => {
    try {
        const scene = await sceneBySlug(req.params.slug as string);
        if (!scene) return res.status(404).json({ error: "Not found" });

        const page = parsePage(req.query.page);
        const limit = clampLimit(req.query.limit);
        const past = parseBool(req.query.past) === true;
        const genreTokens = parseCsv(req.query.genre, 5);

        const rangeParam = req.query.dateRange;
        if (rangeParam !== undefined && !isDateRange(rangeParam)) {
            return res.status(400).json({ error: "Invalid dateRange" });
        }

        const where: any = {
            sceneId: scene.id,
            deletedAt: null,
            date: dateRangeWindow(rangeParam, past),
        };

        if (genreTokens.length) {
            const genreIds = await resolveGenreIds(genreTokens);
            if (genreIds.length === 0) return res.json(paginated([], page, limit));
            // A show's genre is a property of its lineup, so it is derived rather
            // than denormalized -- lineups change, and keeping a ShowGenre table
            // consistent would mean hooking every ShowBand write.
            where.bands = { some: { band: { genres: { some: { genreId: { in: genreIds } } } } } };
        }

        const shows = await prisma.show.findMany({
            where,
            select: {
                id: true,
                date: true,
                doors: true,
                city: true,
                state: true,
                status: true,
                posterUrl: true,
                venueName: true,
                venue: { select: { id: true, name: true, latitude: true, longitude: true } },
                bands: {
                    select: { role: true, band: { select: { id: true, name: true } } },
                },
            },
            orderBy: { date: past ? "desc" : "asc" },
            skip: (page - 1) * limit,
            take: limit,
        });

        res.json(paginated(shows, page, limit));
    } catch (error: any) {
        fail(res, error, "scene");
    }
};
