import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { fail } from '../middlewares/error.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Response } from 'express';
import { Craft } from '../../generated/prisma/enums';
import { stateSpellings } from '../lib/scenes';
import { clampLimit, parsePage, parseCsv, parseBool, parseText } from '../lib/query';

const SEARCH_TYPES = ['user', 'band', 'venue', 'show', 'scene'] as const;
type SearchType = (typeof SEARCH_TYPES)[number];

const MAX_LIMIT = 50;
/**
 * Offset pagination over an in-memory merge is only correct while each type
 * over-fetches to the full offset. Past page 5 that stops being cheap, and nobody
 * pages a search box that far. An honest 400 beats silently wrong results.
 */
const MAX_PAGE = 5;

/** Lower is better. Keeps the ordering stable when scores tie. */
const TYPE_PRIORITY: Record<SearchType, number> = {
  band: 0,
  venue: 1,
  user: 2,
  show: 3,
  scene: 4,
};

type Result = {
  id: string;
  type: Uppercase<SearchType>;
  accountType: string | null;
  name: string;
  subtitle: string;
  profileImageUrl: string | null;
  city?: string | null;
  state?: string | null;
  slug?: string;
  date?: Date;
  genres?: { slug: string; name: string }[];
  crafts?: { craft: string; forHire: boolean }[];
  score: number;
};

/**
 * Relevance. Everything reached here already matched `contains`, so the floor is
 * a substring hit; exact and prefix matches are promoted above it, and local
 * results above distant ones.
 */
const score = (
  name: string,
  q: string,
  sameCity: boolean,
  sameState: boolean,
  hasImage: boolean,
) => {
  const n = name.toLowerCase();
  const t = q.toLowerCase();

  let s = n === t ? 100 : n.startsWith(t) ? 60 : 30;
  if (sameCity) s += 15;
  else if (sameState) s += 8;
  if (hasImage) s += 5;
  return s;
};

const craftLabel = (craft: string) =>
  craft
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const placeLabel = (city?: string | null, state?: string | null) =>
  city && state ? `${city}, ${state}` : city || state || '';

/**
 * GET /search
 *
 * Authenticated. One query across users, bands, venues, shows and scenes.
 *
 *   ?q=          required; anything shorter than 1 char returns an empty envelope
 *   ?type=       csv subset of user,band,venue,show,scene
 *   ?city= &state=
 *   ?genre=      csv of slugs, display names or aliases
 *   ?craft=      csv of Craft values      ?forHire=
 *   ?sceneSlug=
 *   ?page=       1..5      ?limit=  1..50
 *
 * Returns an envelope rather than a bare array, so per-type counts and pagination
 * have somewhere to live.
 */
export const search = async (req: AuthRequest, res: Response) => {
  try {
    const q = parseText(req.query.q, 64);
    const page = parsePage(req.query.page);
    const limit = clampLimit(req.query.limit, 20, MAX_LIMIT);

    if (page > MAX_PAGE) {
      return res.status(400).json({ error: 'Page too deep' });
    }

    const typeTokens = parseCsv(req.query.type, SEARCH_TYPES.length);
    const invalidTypes = typeTokens.filter(t => !SEARCH_TYPES.includes(t.toLowerCase() as SearchType));
    if (invalidTypes.length) {
      return res.status(400).json({ error: `Invalid type: ${invalidTypes.join(', ')}` });
    }
    const types: SearchType[] = typeTokens.length
      ? (typeTokens.map(t => t.toLowerCase()) as SearchType[])
      : [...SEARCH_TYPES];

    const craftTokens = parseCsv(req.query.craft, 6);
    const validCrafts = Object.values(Craft) as string[];
    const invalidCrafts = craftTokens.filter(c => !validCrafts.includes(c.toUpperCase()));
    if (invalidCrafts.length) {
      return res.status(400).json({ error: `Invalid craft: ${invalidCrafts.join(', ')}` });
    }
    const crafts = craftTokens.map(c => c.toUpperCase() as Craft);
    const forHire = parseBool(req.query.forHire);

    const emptyEnvelope = {
      results: [],
      counts: { user: 0, band: 0, venue: 0, show: 0, scene: 0 },
      page,
      limit,
      hasMore: false,
    };

    if (!q) return res.json(emptyEnvelope);

    const city = parseText(req.query.city);
    const state = parseText(req.query.state);
    const sceneSlug = parseText(req.query.sceneSlug);
    const genreTokens = parseCsv(req.query.genre, 5);

    // Resolve the scoping filters first: either can make the whole query empty.
    let sceneId: string | undefined;
    if (sceneSlug) {
      const scene = await prisma.scene.findUnique({
        where: { slug: sceneSlug },
        select: { id: true },
      });
      // A filter, not a resource lookup -- unknown slug means no matches, not 404.
      if (!scene) return res.json(emptyEnvelope);
      sceneId = scene.id;
    }

    let genreIds: string[] | undefined;
    if (genreTokens.length) {
      const lowered = genreTokens.map(t => t.toLowerCase());
      const genres = await prisma.genre.findMany({
        where: {
          OR: [
            { slug: { in: lowered } },
            { name: { in: genreTokens, mode: 'insensitive' } },
            { aliases: { hasSome: lowered } },
          ],
        },
        select: { id: true },
      });
      if (genres.length === 0) return res.json(emptyEnvelope);
      genreIds = genres.map(g => g.id);
    }

    const contains = { contains: q, mode: 'insensitive' as const };
    const locationWhere: any = {};
    if (city) locationWhere.city = { equals: city, mode: 'insensitive' };
    if (state) locationWhere.state = { in: stateSpellings(state), mode: 'insensitive' };

    // Over-fetch to the end of the requested window so the in-memory merge has
    // enough of every type to slice a correct page. Bounded: 5 types x 110 rows.
    const fetch = page * limit + 10;

    const wants = (t: SearchType) => types.includes(t);

    // Genre and craft filters are type-specific; asking for them excludes the
    // types they cannot apply to, rather than returning unfiltered noise.
    const includeUsers = wants('user') && !genreIds;
    const includeBands = wants('band') && crafts.length === 0 && forHire === undefined;
    const includeVenues =
      wants('venue') && !genreIds && crafts.length === 0 && forHire === undefined;
    const includeShows = wants('show') && crafts.length === 0 && forHire === undefined;
    const includeScenes =
      wants('scene') && !genreIds && crafts.length === 0 && forHire === undefined && !sceneId;

    const craftFilter: any = {};
    if (crafts.length) craftFilter.craft = { in: crafts };
    if (forHire !== undefined) craftFilter.forHire = forHire;

    const [users, bands, venues, shows, scenes] = await Promise.all([
      includeUsers
        ? prisma.user.findMany({
            where: {
              deletedAt: null,
              OR: [{ name: contains }, { username: contains }],
              ...locationWhere,
              ...(sceneId ? { sceneId } : {}),
              ...(Object.keys(craftFilter).length ? { crafts: { some: craftFilter } } : {}),
            },
            // select, never include: include on a User returns the password hash.
            select: {
              id: true,
              name: true,
              username: true,
              city: true,
              state: true,
              profileImageUrl: true,
              accountType: true,
              crafts: { select: { craft: true, forHire: true }, orderBy: { position: 'asc' } },
            },
            take: fetch,
          })
        : [],

      includeBands
        ? prisma.band.findMany({
            where: {
              deletedAt: null,
              name: contains,
              ...locationWhere,
              ...(sceneId ? { sceneId } : {}),
              ...(genreIds ? { genres: { some: { genreId: { in: genreIds } } } } : {}),
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
                orderBy: { position: 'asc' },
              },
            },
            take: fetch,
          })
        : [],

      includeVenues
        ? prisma.venue.findMany({
            where: {
              deletedAt: null,
              name: contains,
              ...locationWhere,
              ...(sceneId ? { sceneId } : {}),
            },
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              profileImageUrl: true,
              accountType: true,
            },
            take: fetch,
          })
        : [],

      includeShows
        ? prisma.show.findMany({
            where: {
              deletedAt: null,
              date: { gte: new Date() },
              ...locationWhere,
              ...(sceneId ? { sceneId } : {}),
              ...(genreIds
                ? { bands: { some: { band: { genres: { some: { genreId: { in: genreIds } } } } } } }
                : {}),
              OR: [
                { venueName: contains },
                { venue: { name: contains } },
                { bands: { some: { band: { name: contains } } } },
              ],
            },
            select: {
              id: true,
              date: true,
              city: true,
              state: true,
              posterUrl: true,
              venueName: true,
              venue: { select: { name: true } },
            },
            orderBy: { date: 'asc' },
            take: fetch,
          })
        : [],

      includeScenes
        ? prisma.scene.findMany({
            where: {
              deletedAt: null,
              OR: [{ name: contains }, { city: contains }],
              ...(state ? { state: { in: stateSpellings(state), mode: 'insensitive' } } : {}),
            },
            select: {
              id: true,
              slug: true,
              name: true,
              city: true,
              state: true,
              imageUrl: true,
            },
            take: fetch,
          })
        : [],
    ]);

    const sameCity = (c?: string | null) => !!city && c?.toLowerCase() === city.toLowerCase();
    const sameState = (s?: string | null) => !!state && s?.toLowerCase() === state.toLowerCase();

    const results: Result[] = [
      ...users.map(u => ({
        id: u.id,
        type: 'USER' as const,
        accountType: u.accountType as string,
        name: u.name,
        subtitle: u.crafts.length
          ? `${craftLabel(u.crafts[0].craft)}${u.crafts.some(c => c.forHire) ? ' · For hire' : ''}`
          : `@${u.username}`,
        profileImageUrl: u.profileImageUrl,
        city: u.city,
        state: u.state,
        crafts: u.crafts,
        score: score(u.name, q, sameCity(u.city), sameState(u.state), !!u.profileImageUrl),
      })),

      ...bands.map(b => {
        const genres = b.genres.map(g => g.genre);
        const genreLabel = genres[0]?.name ?? 'Band';
        const place = placeLabel(b.city, b.state);
        return {
          id: b.id,
          type: 'BAND' as const,
          accountType: b.accountType as string,
          name: b.name,
          subtitle: place ? `${genreLabel} · ${place}` : genreLabel,
          profileImageUrl: b.profileImageUrl,
          city: b.city,
          state: b.state,
          genres,
          score: score(b.name, q, sameCity(b.city), sameState(b.state), !!b.profileImageUrl),
        };
      }),

      ...venues.map(v => ({
        id: v.id,
        type: 'VENUE' as const,
        accountType: v.accountType as string,
        name: v.name,
        subtitle: placeLabel(v.city, v.state) || 'Venue',
        profileImageUrl: v.profileImageUrl,
        city: v.city,
        state: v.state,
        score: score(v.name, q, sameCity(v.city), sameState(v.state), !!v.profileImageUrl),
      })),

      ...shows.map(s => {
        const name = s.venue?.name ?? s.venueName ?? s.city;
        const when = s.date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        return {
          id: s.id,
          type: 'SHOW' as const,
          accountType: null,
          name,
          subtitle: `${when} · ${placeLabel(s.city, s.state)}`,
          profileImageUrl: s.posterUrl,
          city: s.city,
          state: s.state,
          date: s.date,
          score: score(name, q, sameCity(s.city), sameState(s.state), !!s.posterUrl),
        };
      }),

      ...scenes.map(s => ({
        id: s.id,
        type: 'SCENE' as const,
        accountType: null,
        name: s.name,
        subtitle: placeLabel(s.city, s.state),
        profileImageUrl: s.imageUrl,
        city: s.city,
        state: s.state,
        slug: s.slug,
        score: score(s.name, q, sameCity(s.city), sameState(s.state), !!s.imageUrl),
      })),
    ];

    results.sort(
      (a, b) =>
        b.score - a.score ||
        TYPE_PRIORITY[a.type.toLowerCase() as SearchType] -
          TYPE_PRIORITY[b.type.toLowerCase() as SearchType] ||
        a.name.localeCompare(b.name),
    );

    const start = (page - 1) * limit;
    const window = results.slice(start, start + limit);

    // Search is re-issued on every keystroke; a short private cache absorbs the
    // duplicate requests a debounce does not.
    res.set('Cache-Control', 'private, max-age=15');

    res.json({
      results: window,
      counts: {
        user: users.length,
        band: bands.length,
        venue: venues.length,
        show: shows.length,
        scene: scenes.length,
      },
      page,
      limit,
      hasMore: results.length > start + limit,
    });
  } catch (error: any) {
    fail(res, error, 'search');
  }
};
