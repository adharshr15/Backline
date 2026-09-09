import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AccountType, InviteStatus, ShowStatus } from "../../generated/prisma/client";
import { ParticipantType } from "../../generated/prisma/enums";
import { canActAs, canActAsLower } from "../lib/authorization";
import { resolveSceneId } from "../lib/scenes";
import { clampLimit, parsePage } from "../lib/query";


/** Returns a valid Date, or null for a missing/unparseable value. */
const parseDate = (value: unknown): Date | null => {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Helper: Check if user manages show
export const canManageShow = async (showId: string, userId: string) => {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      venue: { include: { representatives: true } },
      createdByBand: { include: { members: true } },
      createdByVenue: { include: { representatives: true } },
    }
  });

  if (!show) return false;

  // Created directly by this user
  if (show.createdByUserId === userId) return true;

  // Member of the band that created the show
  if (show.createdByBand?.members.some(m => m.userId === userId)) return true;

  // Rep of the venue that created the show
  if (show.createdByVenue?.representatives.some(r => r.userId === userId)) return true;

  // Rep of the venue attached to the show
  if (show.venue?.representatives.some(r => r.userId === userId)) return true;

  return false;
};



// READ

export const getShows = async (req: Request, res: Response) => {
  try {
    const { bandId, venueId, userId, past, city, state, dateRange } = req.query as Record<string, string | undefined>;
    const now = new Date();

    const where: any = {
      deletedAt: null,
      date: past === 'true' ? { lt: now } : { gte: now },
    };

    if (city)  where.city  = { equals: city,  mode: 'insensitive' };
    if (state) where.state = { equals: state, mode: 'insensitive' };

    if (dateRange && dateRange !== 'all' && past !== 'true') {
      const end = dateRange === 'today' ? new Date(new Date().setHours(23, 59, 59, 999))
                : dateRange === 'week'  ? new Date(Date.now() + 7 * 86400000)
                :                         new Date(Date.now() + 30 * 86400000);
      where.date = { gte: now, lte: end };
    }

    if (bandId) {
      where.OR = [
        { createdByBandId: bandId },
        { bands: { some: { bandId } } },
        { repostedByBands: { some: { id: bandId } } },
      ];
    } else if (venueId) {
      where.OR = [
        { venueId },
        { createdByVenueId: venueId },
        { repostedByVenues: { some: { id: venueId } } },
      ];
    } else if (userId) {
      where.OR = [
        { createdByUserId: userId },
        { repostedByUsers: { some: { id: userId } } },
      ];
    }

    const shows = await prisma.show.findMany({
      where,
      include: {
        venue: true,
        tour: true,
        bands: { include: { band: true } },
        repostedByBands: { select: { id: true } },
        repostedByUsers: { select: { id: true } },
        repostedByVenues: { select: { id: true } },
        rsvpBands: { select: { id: true } },
        rsvpUsers: { select: { id: true } },
        rsvpVenues: { select: { id: true } },
      },
      orderBy: { date: past === 'true' ? 'desc' : 'asc' },
    });

    res.json(shows);
  } catch (error: any) {
    fail(res, error, "show");
  }
};

export const getShowById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const show = await prisma.show.findFirst({
      where: { id, deletedAt: null },
      include: {
        venue: true,
        tour: true,
        bands: { include: { band: true } },
        repostedByBands: { select: { id: true } },
        repostedByUsers: { select: { id: true } },
        repostedByVenues: { select: { id: true } },
        rsvpBands: { select: { id: true } },
        rsvpUsers: { select: { id: true } },
        rsvpVenues: { select: { id: true } },
      }
    });

    if (!show) return res.status(404).json({ error: "Show not found" });

    res.json(show);
  } catch (error: any) {
    fail(res, error, "show");
  }
};

export const getMyShowInvites = async (req: AuthRequest, res: Response) => {
  try {

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const invites = await prisma.showInvite.findMany({
      where: {
        band: {
          members: {
            some: { userId }
          }
        },
        status: InviteStatus.PENDING
      },
      include: {
        show: true,
        band: true
      }
    });

    res.json(invites);

  } catch (error: any) {
    fail(res, error, "show");
  }
};

// CREATE

export const createShow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { date, city, state, country, venueId, venueName, venueAddress, bandLineup, tourId, bandIds = [], doors, status, notes, ticketsUrl, creatorUserId, creatorBandId, creatorVenueId }: {
      date: string
      city: string
      state: string
      country: string
      venueId?: string
      venueName?: string
      venueAddress?: string
      bandLineup?: string
      tourId?: string
      bandIds?: string[]
      doors: string
      status: ShowStatus
      notes?: string
      ticketsUrl: string
      creatorUserId?: string
      creatorBandId?: string
      creatorVenueId?: string
    } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const files = req.files as Record<string, Express.Multer.File[]>;

    // Check that only one creator exists
    const creatorCount = [ creatorUserId, creatorBandId, creatorVenueId ].filter((v) => v !== undefined && v !== null).length;
    if (creatorCount != 1) {
      // 402 is Payment Required; this is a malformed request.
      return res.status(400).json({ error: "There can only be one creator of a show" });
    }

    if (!city || !state || !country) {
      return res.status(400).json({ error: "city, state and country are required" });
    }

    // `date` and `doors` are both required non-null DateTimes in the schema. Parsing
    // them here turns a missing or malformed value into a 400 instead of a Prisma 500.
    const showDate = parseDate(date);
    if (!showDate) return res.status(400).json({ error: "A valid date is required" });

    const doorsDate = parseDate(doors);
    if (!doorsDate) return res.status(400).json({ error: "A valid doors time is required" });

    if (status && !Object.values(ShowStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Check that user is creator user (only when creatorUserId is specified)
    if (creatorUserId && creatorUserId !== userId) {
      return res.status(403).json({ error: "You must be the creator user" });
    }

    // Check that user is in the creator band
    if (creatorBandId) {
      const membership = await prisma.bandMember.findFirst({ where: { bandId: creatorBandId, userId } });
      if (!membership) return res.status(403).json({ error: "You must be a member of the creator band" });
    }

    // Check that user is in creator venue
    if (creatorVenueId) {
      const representative = await prisma.venueRepresentative.findFirst({where: { venueId: creatorVenueId, userId}});
      if (!representative) return res.status(403).json({ error: "You must be a representative of the creator venue"});
    }

    const posterImageUrl = files?.posterImage?.[0]
      ? `/uploads/${files.posterImage[0].filename}`
      : undefined

    // From the show's own city/state, not the venue's -- venueId is nullable, and
    // deriving through the venue would drop every DIY/house show from discovery.
    const sceneId = await resolveSceneId({ city, state, country });

    const show = await prisma.$transaction(async (tx) => {
      // Create show with creator band
      const newShow = await tx.show.create({
        data: {
          date: showDate,
          city,
          state,
          country,
          sceneId,
          tourId,
          doors: doorsDate,
          posterUrl: posterImageUrl,
          ticketsUrl,
          status,
          notes,
          venueName: venueId ? undefined : venueName,
          venueAddress: venueId ? undefined : venueAddress,
          bandLineup: bandLineup || undefined,
          createdByBandId: creatorBandId,
          createdByUserId: creatorUserId,
          createdByVenueId: creatorVenueId
        }
      });

      if (bandIds.length) {
        const uniqueBandIds = [...new Set(bandIds as string[])];

        if (creatorBandId) {
          // Creator band is added directly; others get invites
          await tx.showBand.create({ data: { bandId: creatorBandId, showId: newShow.id } });
          const bandsToInvite = uniqueBandIds.filter(id => id !== creatorBandId);
          if (bandsToInvite.length) {
            await tx.showInvite.createMany({
              data: bandsToInvite.map((bandId: string) => ({ bandId, showId: newShow.id, status: "PENDING" }))
            });
          }
        } else {
          // User/venue creator — all bands get invites
          await tx.showInvite.createMany({
            data: uniqueBandIds.map((bandId: string) => ({ bandId, showId: newShow.id, status: "PENDING" }))
          });
        }
      }

      if (venueId) {
        await tx.showInvite.create({
          data: { venueId, showId: newShow.id, status: "PENDING" }
        });
      }

      return newShow;

    });

    const fullShow = await prisma.show.findUnique({
      where: { id: show.id },
      include: {
        venue: true,
        tour: true,
        bands: { include: { band: true } },
        showInvites: { include: { band: true } }
      }
    });

    res.status(201).json(fullShow);

  } catch (error: any) {
    fail(res, error, "show");
  }
};


// UPDATE

export const updateShow = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageShow(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const { date, city, state, country, venueId, venueName, venueAddress, bandLineup, tourId, addBandIds, removeBandIds: removeBandIdsRaw, doors, status, notes, ticketsUrl } = req.body;

    const files = req.files as Record<string, Express.Multer.File[]>;
    const posterUrl = files?.posterImage?.[0] ? `/uploads/${files.posterImage[0].filename}` : undefined;

    // Reject malformed dates/status up front rather than letting Prisma 500.
    const nextDate = date !== undefined ? parseDate(date) : undefined;
    if (date !== undefined && !nextDate) {
      return res.status(400).json({ error: "A valid date is required" });
    }

    const nextDoors = doors !== undefined ? parseDate(doors) : undefined;
    if (doors !== undefined && !nextDoors) {
      return res.status(400).json({ error: "A valid doors time is required" });
    }

    if (status !== undefined && !Object.values(ShowStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Keep sceneId tracking the show's current city/state. Resolved against the
    // merged location, and outside the transaction since it may create a Scene.
    let nextSceneId: string | null | undefined;
    if (city || state || country) {
      const existing = await prisma.show.findUnique({
        where: { id },
        select: { city: true, state: true, country: true },
      });
      nextSceneId = await resolveSceneId({
        city: city ?? existing?.city,
        state: state ?? existing?.state,
        country: country ?? existing?.country,
      });
    }

    const updatedShow = await prisma.$transaction(async (tx) => {
      // --- Venue: decide what to update ---
      let venueUpdate: Record<string, any> = {};

      const currentShow = await tx.show.findUnique({ where: { id }, select: { venueId: true } });

      if (venueId) {
        if (currentShow?.venueId !== venueId) {
          if (currentShow?.venueId) {
            await tx.showInvite.deleteMany({ where: { showId: id, venueId: currentShow.venueId } });
          }
          const existingPending = await tx.showInvite.findFirst({ where: { showId: id, venueId, status: "PENDING" } });
          if (!existingPending) {
            await tx.showInvite.create({ data: { showId: id, venueId, status: "PENDING" } });
          }
        }
      } else if (venueName !== undefined) {
        if (currentShow?.venueId) {
          await tx.showInvite.deleteMany({ where: { showId: id, venueId: currentShow.venueId } });
        }
        venueUpdate = { venueName: venueName || null, venueAddress: venueAddress ?? null, venueId: null };
      }

      // --- Main show update ---
      await tx.show.update({
        where: { id },
        data: {
          date: nextDate ?? undefined,
          doors: nextDoors ?? undefined,
          city, state, country, tourId, status, notes, ticketsUrl,
          ...(nextSceneId !== undefined ? { sceneId: nextSceneId } : {}),
          ...venueUpdate,
          ...(bandLineup !== undefined ? { bandLineup: bandLineup || null } : {}),
          ...(posterUrl && { posterUrl }),
        }
      });

      // --- Band invite additions ---
      const bandsToAdd: string[] = addBandIds
        ? (Array.isArray(addBandIds) ? addBandIds : [addBandIds])
        : [];
      for (const bid of bandsToAdd) {
        const [existingInvite, existingMember] = await Promise.all([
          tx.showInvite.findFirst({ where: { showId: id, bandId: bid, status: "PENDING" } }),
          tx.showBand.findUnique({ where: { bandId_showId: { bandId: bid, showId: id } } }),
        ]);
        if (!existingInvite && !existingMember) {
          await tx.showInvite.create({ data: { showId: id, bandId: bid, status: "PENDING" } });
        }
      }

      // --- Band removals (creator removing a band from the show) ---
      const bandsToRemove: string[] = removeBandIdsRaw
        ? (Array.isArray(removeBandIdsRaw) ? removeBandIdsRaw : [removeBandIdsRaw])
        : [];
      for (const bid of bandsToRemove) {
        await tx.showBand.deleteMany({ where: { bandId: bid, showId: id } });
        // Delete ALL invites for this band+show (any status) so re-inviting later is clean
        await tx.showInvite.deleteMany({ where: { showId: id, bandId: bid } });
      }

      return tx.show.findUnique({
        where: { id },
        include: {
          venue: true,
          tour: true,
          bands: { include: { band: true } },
          showInvites: { include: { band: true } },
          createdByBand: { include: { members: true } }
        }
      });
    });

    res.json(updatedShow);

  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Show not found" });
    fail(res, error, "show");
  }
};


// LEAVE SHOW (self-removal by a band or venue that didn't create the show)

export const leaveShow = async (req: AuthRequest, res: Response) => {
  try {
    const showId = req.params.id as string;
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { bandId, venueId } = req.body as { bandId?: string; venueId?: string };

    if (bandId) {
      const membership = await prisma.bandMember.findFirst({ where: { userId, bandId } });
      if (!membership) return res.status(403).json({ error: "Not a band member" });
      await prisma.$transaction(async (tx) => {
        await tx.showBand.deleteMany({ where: { bandId, showId } });
        await tx.showInvite.deleteMany({ where: { showId, bandId } });
      });
    } else if (venueId) {
      const rep = await prisma.venueRepresentative.findFirst({ where: { userId, venueId } });
      if (!rep) return res.status(403).json({ error: "Not a venue representative" });
      await prisma.$transaction(async (tx) => {
        await tx.showInvite.deleteMany({ where: { showId, venueId } });
        await tx.show.update({ where: { id: showId }, data: { venueId: null } });
      });
    } else {
      return res.status(400).json({ error: "bandId or venueId required" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    fail(res, error, "show");
  }
};

// DELETE

export const deleteShow = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageShow(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    await prisma.show.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: "Show deleted" });

  } catch (error: any) {
    if (error.code === "P2025")
      return res.status(404).json({ error: "Show not found" });

    fail(res, error, "show");
  }
};


// REPOST

export const repostShow = async (req: AuthRequest, res: Response) => {
  try {
    const showId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { reposterType, reposterBandId, reposterVenueId } = req.body as {
      reposterType: 'user' | 'band' | 'venue';
      reposterBandId?: string;
      reposterVenueId?: string;
    };

    const show = await prisma.show.findFirst({ where: { id: showId, deletedAt: null } });
    if (!show) return res.status(404).json({ error: "Show not found" });

    if (reposterType === 'band') {
      if (!reposterBandId) return res.status(400).json({ error: "reposterBandId required" });
      const membership = await prisma.bandMember.findFirst({ where: { bandId: reposterBandId, userId } });
      if (!membership) return res.status(403).json({ error: "Not a member of this band" });
      const existing = await prisma.show.findFirst({ where: { id: showId, repostedByBands: { some: { id: reposterBandId } } } });
      if (existing) return res.status(409).json({ error: "Already reposted" });
      await prisma.show.update({ where: { id: showId }, data: { repostedByBands: { connect: { id: reposterBandId } } } });
    } else if (reposterType === 'venue') {
      if (!reposterVenueId) return res.status(400).json({ error: "reposterVenueId required" });
      const rep = await prisma.venueRepresentative.findFirst({ where: { venueId: reposterVenueId, userId } });
      if (!rep) return res.status(403).json({ error: "Not a representative of this venue" });
      const existing = await prisma.show.findFirst({ where: { id: showId, repostedByVenues: { some: { id: reposterVenueId } } } });
      if (existing) return res.status(409).json({ error: "Already reposted" });
      await prisma.show.update({ where: { id: showId }, data: { repostedByVenues: { connect: { id: reposterVenueId } } } });
    } else {
      const existing = await prisma.show.findFirst({ where: { id: showId, repostedByUsers: { some: { id: userId } } } });
      if (existing) return res.status(409).json({ error: "Already reposted" });
      await prisma.show.update({ where: { id: showId }, data: { repostedByUsers: { connect: { id: userId } } } });
    }

    res.json({ message: "Reposted" });
  } catch (error: any) {
    fail(res, error, "show");
  }
};

export const unrepostShow = async (req: AuthRequest, res: Response) => {
  try {
    const showId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { reposterType, reposterBandId, reposterVenueId } = req.body as {
      reposterType: 'user' | 'band' | 'venue';
      reposterBandId?: string;
      reposterVenueId?: string;
    };

    if (reposterType === 'band') {
      if (!reposterBandId) return res.status(400).json({ error: "reposterBandId required" });
      // `repostShow` checks membership; this path must too, or anyone can remove
      // any band's repost.
      if (!(await canActAs(userId, ParticipantType.BAND, reposterBandId))) {
        return res.status(403).json({ error: "Not a member of this band" });
      }
      await prisma.show.update({ where: { id: showId }, data: { repostedByBands: { disconnect: { id: reposterBandId } } } });
    } else if (reposterType === 'venue') {
      if (!reposterVenueId) return res.status(400).json({ error: "reposterVenueId required" });
      if (!(await canActAs(userId, ParticipantType.VENUE, reposterVenueId))) {
        return res.status(403).json({ error: "Not a representative of this venue" });
      }
      await prisma.show.update({ where: { id: showId }, data: { repostedByVenues: { disconnect: { id: reposterVenueId } } } });
    } else {
      await prisma.show.update({ where: { id: showId }, data: { repostedByUsers: { disconnect: { id: userId } } } });
    }

    res.json({ message: "Unreposted" });
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Show not found" });
    fail(res, error, "show");
  }
};


// FEED

/** Cap on the follow graph read into memory to build the feed query. */
const FEED_FOLLOW_CAP = 1000;

/**
 * GET /shows/feed?followerType=&followerId=&page=&limit=
 *
 * Authenticated. The feed is a profile's personalized view, built from who it
 * follows -- reading it discloses that profile's entire follow graph, so the
 * caller must be able to act as the profile.
 */
export const getFeedShows = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { followerType, followerId } = req.query as Record<string, string>;
    if (!followerType || !followerId) {
      return res.status(400).json({ error: "followerType and followerId are required" });
    }

    const typeMap: Record<string, AccountType> = { user: 'USER', band: 'BAND', venue: 'VENUE' };
    const dbType = typeMap[followerType];
    if (!dbType) return res.status(400).json({ error: "Invalid followerType" });

    if (!(await canActAsLower(userId, followerType, followerId))) {
      return res.status(403).json({ error: "You cannot read this profile's feed" });
    }

    const page = parsePage(req.query.page);
    const limit = clampLimit(req.query.limit, 30);

    const followerFilter =
      followerType === 'band'  ? { followerBandId: followerId } :
      followerType === 'venue' ? { followerVenueId: followerId } :
                                 { followerUserId: followerId };

    const follows = await prisma.follow.findMany({
      where: { followerType: dbType, ...followerFilter },
      select: { followeeType: true, followeeBandId: true, followeeVenueId: true, followeeUserId: true },
      take: FEED_FOLLOW_CAP,
    });

    const sceneFollows = await prisma.sceneFollow.findMany({
      where: { followerId, followerType },
      select: { sceneId: true },
      take: FEED_FOLLOW_CAP,
    });

    if (follows.length === 0 && sceneFollows.length === 0) return res.json([]);

    // Collect ids first, then emit a fixed number of clauses. Building one clause
    // per followed profile meant a profile following 500 bands produced a
    // 1500-clause OR; this is always at most nine.
    const sceneIds = sceneFollows.map(sf => sf.sceneId);
    const bandIds: string[] = [];
    const venueIds: string[] = [];
    const followedUserIds: string[] = [];

    for (const f of follows) {
      if (f.followeeType === 'BAND' && f.followeeBandId) bandIds.push(f.followeeBandId);
      else if (f.followeeType === 'VENUE' && f.followeeVenueId) venueIds.push(f.followeeVenueId);
      else if (f.followeeType === 'USER' && f.followeeUserId) followedUserIds.push(f.followeeUserId);
    }

    const orConditions: any[] = [];
    // Scene follows used to contribute an insensitive city/state pair each, which
    // compiles to ILIKE and cannot use an index. sceneId is an indexed equality.
    if (sceneIds.length) orConditions.push({ sceneId: { in: sceneIds } });
    if (bandIds.length) {
      orConditions.push({ createdByBandId: { in: bandIds } });
      orConditions.push({ bands: { some: { bandId: { in: bandIds } } } });
      orConditions.push({ repostedByBands: { some: { id: { in: bandIds } } } });
    }
    if (venueIds.length) {
      orConditions.push({ venueId: { in: venueIds } });
      orConditions.push({ createdByVenueId: { in: venueIds } });
      orConditions.push({ repostedByVenues: { some: { id: { in: venueIds } } } });
    }
    if (followedUserIds.length) {
      orConditions.push({ createdByUserId: { in: followedUserIds } });
      orConditions.push({ repostedByUsers: { some: { id: { in: followedUserIds } } } });
    }

    if (orConditions.length === 0) return res.json([]);

    const shows = await prisma.show.findMany({
      where: { deletedAt: null, date: { gte: new Date() }, OR: orConditions },
      include: {
        venue: true,
        tour: true,
        bands: { include: { band: true } },
        repostedByBands: { select: { id: true } },
        repostedByUsers: { select: { id: true } },
        repostedByVenues: { select: { id: true } },
        rsvpBands: { select: { id: true } },
        rsvpUsers: { select: { id: true } },
        rsvpVenues: { select: { id: true } },
      },
      orderBy: { date: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json(shows);
  } catch (error: any) {
    fail(res, error, "show");
  }
};


// RSVP

export const rsvpShow = async (req: AuthRequest, res: Response) => {
  try {
    const showId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { rsvpType, rsvpBandId, rsvpVenueId } = req.body as {
      rsvpType: 'user' | 'band' | 'venue';
      rsvpBandId?: string;
      rsvpVenueId?: string;
    };

    const show = await prisma.show.findFirst({ where: { id: showId, deletedAt: null } });
    if (!show) return res.status(404).json({ error: "Show not found" });

    if (rsvpType === 'band') {
      if (!rsvpBandId) return res.status(400).json({ error: "rsvpBandId required" });
      const membership = await prisma.bandMember.findFirst({ where: { bandId: rsvpBandId, userId } });
      if (!membership) return res.status(403).json({ error: "Not a member of this band" });
      const existing = await prisma.show.findFirst({ where: { id: showId, rsvpBands: { some: { id: rsvpBandId } } } });
      if (existing) return res.status(409).json({ error: "Already RSVP'd" });
      await prisma.show.update({ where: { id: showId }, data: { rsvpBands: { connect: { id: rsvpBandId } } } });
    } else if (rsvpType === 'venue') {
      if (!rsvpVenueId) return res.status(400).json({ error: "rsvpVenueId required" });
      const rep = await prisma.venueRepresentative.findFirst({ where: { venueId: rsvpVenueId, userId } });
      if (!rep) return res.status(403).json({ error: "Not a representative of this venue" });
      const existing = await prisma.show.findFirst({ where: { id: showId, rsvpVenues: { some: { id: rsvpVenueId } } } });
      if (existing) return res.status(409).json({ error: "Already RSVP'd" });
      await prisma.show.update({ where: { id: showId }, data: { rsvpVenues: { connect: { id: rsvpVenueId } } } });
    } else {
      const existing = await prisma.show.findFirst({ where: { id: showId, rsvpUsers: { some: { id: userId } } } });
      if (existing) return res.status(409).json({ error: "Already RSVP'd" });
      await prisma.show.update({ where: { id: showId }, data: { rsvpUsers: { connect: { id: userId } } } });
    }

    res.json({ message: "RSVP'd" });
  } catch (error: any) {
    fail(res, error, "show");
  }
};

export const unrsvpShow = async (req: AuthRequest, res: Response) => {
  try {
    const showId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { rsvpType, rsvpBandId, rsvpVenueId } = req.body as {
      rsvpType: 'user' | 'band' | 'venue';
      rsvpBandId?: string;
      rsvpVenueId?: string;
    };

    if (rsvpType === 'band') {
      if (!rsvpBandId) return res.status(400).json({ error: "rsvpBandId required" });
      // `rsvpShow` checks membership; this path must too.
      if (!(await canActAs(userId, ParticipantType.BAND, rsvpBandId))) {
        return res.status(403).json({ error: "Not a member of this band" });
      }
      await prisma.show.update({ where: { id: showId }, data: { rsvpBands: { disconnect: { id: rsvpBandId } } } });
    } else if (rsvpType === 'venue') {
      if (!rsvpVenueId) return res.status(400).json({ error: "rsvpVenueId required" });
      if (!(await canActAs(userId, ParticipantType.VENUE, rsvpVenueId))) {
        return res.status(403).json({ error: "Not a representative of this venue" });
      }
      await prisma.show.update({ where: { id: showId }, data: { rsvpVenues: { disconnect: { id: rsvpVenueId } } } });
    } else {
      await prisma.show.update({ where: { id: showId }, data: { rsvpUsers: { disconnect: { id: userId } } } });
    }

    res.json({ message: "RSVP removed" });
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Show not found" });
    fail(res, error, "show");
  }
};

export const getRsvpShows = async (req: AuthRequest, res: Response) => {
  try {
    const { profileType, profileId } = req.query as Record<string, string>;
    if (!profileType || !profileId) {
      return res.status(400).json({ error: "profileType and profileId are required" });
    }

    const where: any =
      profileType === 'band'  ? { rsvpBands:  { some: { id: profileId } }, deletedAt: null } :
      profileType === 'venue' ? { rsvpVenues: { some: { id: profileId } }, deletedAt: null } :
                                { rsvpUsers:  { some: { id: profileId } }, deletedAt: null };

    const shows = await prisma.show.findMany({
      where,
      include: {
        venue: true,
        tour: true,
        bands: { include: { band: true } },
        repostedByBands: { select: { id: true } },
        repostedByUsers: { select: { id: true } },
        repostedByVenues: { select: { id: true } },
        rsvpBands: { select: { id: true } },
        rsvpUsers: { select: { id: true } },
        rsvpVenues: { select: { id: true } },
      },
      orderBy: { date: 'asc' },
    });

    res.json(shows);
  } catch (error: any) {
    fail(res, error, "show");
  }
};


// MEDIA


