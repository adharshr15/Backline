import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AccountType, InviteStatus, ShowStatus } from "../../generated/prisma/client";


// Helper: Check if user manages show
const canManageShow = async (showId: string, userId: string) => {
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
    const { bandId, venueId, userId, past } = req.query as Record<string, string | undefined>;
    const now = new Date();

    const where: any = {
      deletedAt: null,
      date: past === 'true' ? { lt: now } : { gte: now },
    };

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
      },
      orderBy: { date: past === 'true' ? 'desc' : 'asc' },
    });

    res.json(shows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
        bands: { include: { band: true } }
      }
    });

    if (!show) return res.status(404).json({ error: "Show not found" });

    res.json(show);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};

// CREATE

export const createShow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { date, city, state, country, venueId, tourId, bandIds = [], doors, status, notes, ticketsUrl, creatorUserId, creatorBandId, creatorVenueId }: {
      date: string
      city: string
      state: string
      country: string
      venueId?: string
      venueName?: string
      venueAddress: string
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
      return res.status(402).json({ error: "There can only be one creator of a show" });
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

    const show = await prisma.$transaction(async (tx) => {
      // Create show with creator band
      const newShow = await tx.show.create({
        data: {
          date: new Date(date),
          city,
          state,
          country,
          tourId,
          doors,
          posterUrl: posterImageUrl,
          ticketsUrl,
          status,
          notes,
          createdByBandId: creatorBandId,
          createdByUserId: creatorUserId,
          createdByVenueId: creatorVenueId
        }
      });

      if (creatorBandId && bandIds.length) {
        // Automatically add the creator band to the show
        await tx.showBand.create({
          data: {
            bandId: creatorBandId,
            showId: newShow.id
          }
        });

        // Invite the rest of the specified bands
        const uniqueBandIds = [...new Set(bandIds)];
        const bandsToInvite = uniqueBandIds.filter(id => id !== creatorBandId);

        if (bandsToInvite.length) {
          await tx.showInvite.createMany({
            data: bandsToInvite.map((bandId: string) => ({
              bandId,
              showId: newShow.id,
              status: "PENDING"
            }))
          });
        }
      }

      if (venueId) {
        // Find which venues the user belongs to 
        const representatives = await tx.venueRepresentative.findMany({ where: { userId, venueId } })
        const userVenueIds = representatives.map(m => m.venueId);
        const userInVenue = userVenueIds.includes(venueId);

        if (userInVenue) {
          // Add venue to show
          await tx.show.update({
            where: { id: newShow.id },
            data: { venueId }
          })

        } else {
          // Send invite to venue
          await tx.showInvite.create({
            data: { venueId, showId: newShow.id, status: "PENDING" }
          })
        }
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
    res.status(500).json({ error: error.message });
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

    const { date, city, state, country, venueId, tourId, addBandId, removeBandId, doors, status, notes, ticketsUrl } = req.body;

    const files = req.files as Record<string, Express.Multer.File[]>;
    const posterUrl = files?.posterImage?.[0] ? `/uploads/${files.posterImage[0].filename}` : undefined;

    const updatedShow = await prisma.$transaction(async (tx) => {
      await tx.show.update({
        where: { id },
        data: {
          date: date ? new Date(date) : undefined,
          city, state, country, venueId, tourId, doors, status, notes, ticketsUrl,
          ...(posterUrl && { posterUrl }),
        }
      });

      // Add band invites
      if (addBandId) {
        const existingInvite = await tx.showInvite.findFirst({
          where: {
            showId: id,
            bandId: addBandId,
            status: "PENDING"
          }
        });

        if (!existingInvite) {
          await tx.showInvite.create({
            data: {
              showId: id,
              bandId: addBandId,
              status: "PENDING"
            }
          });
        }
      }

      // Remove band from show
      if (removeBandId) {
        await tx.showBand.delete({
          where: {
            bandId_showId: {
              bandId: removeBandId,
              showId: id
            }
          }
        });
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
    res.status(500).json({ error: error.message });
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

    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
      await prisma.show.update({ where: { id: showId }, data: { repostedByBands: { disconnect: { id: reposterBandId } } } });
    } else if (reposterType === 'venue') {
      if (!reposterVenueId) return res.status(400).json({ error: "reposterVenueId required" });
      await prisma.show.update({ where: { id: showId }, data: { repostedByVenues: { disconnect: { id: reposterVenueId } } } });
    } else {
      await prisma.show.update({ where: { id: showId }, data: { repostedByUsers: { disconnect: { id: userId } } } });
    }

    res.json({ message: "Unreposted" });
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Show not found" });
    res.status(500).json({ error: error.message });
  }
};


// FEED

export const getFeedShows = async (req: Request, res: Response) => {
  try {
    const { followerType, followerId } = req.query as Record<string, string>;
    if (!followerType || !followerId) {
      return res.status(400).json({ error: "followerType and followerId are required" });
    }

    const typeMap: Record<string, AccountType> = { user: 'USER', band: 'BAND', venue: 'VENUE' };
    const dbType = typeMap[followerType];
    if (!dbType) return res.status(400).json({ error: "Invalid followerType" });

    const followerFilter =
      followerType === 'band'  ? { followerBandId: followerId } :
      followerType === 'venue' ? { followerVenueId: followerId } :
                                 { followerUserId: followerId };

    const follows = await prisma.follow.findMany({
      where: { followerType: dbType, ...followerFilter },
    });

    if (follows.length === 0) return res.json([]);

    const orConditions: any[] = [];
    for (const f of follows) {
      if (f.followeeType === 'BAND' && f.followeeBandId) {
        orConditions.push({ createdByBandId: f.followeeBandId });
        orConditions.push({ bands: { some: { bandId: f.followeeBandId } } });
        orConditions.push({ repostedByBands: { some: { id: f.followeeBandId } } });
      } else if (f.followeeType === 'VENUE' && f.followeeVenueId) {
        orConditions.push({ venueId: f.followeeVenueId });
        orConditions.push({ createdByVenueId: f.followeeVenueId });
        orConditions.push({ repostedByVenues: { some: { id: f.followeeVenueId } } });
      } else if (f.followeeType === 'USER' && f.followeeUserId) {
        orConditions.push({ createdByUserId: f.followeeUserId });
        orConditions.push({ repostedByUsers: { some: { id: f.followeeUserId } } });
      }
    }

    const shows = await prisma.show.findMany({
      where: { deletedAt: null, date: { gte: new Date() }, OR: orConditions },
      include: {
        venue: true,
        tour: true,
        bands: { include: { band: true } },
        repostedByBands: { select: { id: true } },
        repostedByUsers: { select: { id: true } },
        repostedByVenues: { select: { id: true } },
      },
      orderBy: { date: 'asc' },
    });

    res.json(shows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


