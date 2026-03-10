import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { InviteStatus, ShowStatus } from "../../generated/prisma/client";


// Helper: Check if user manages show
const canManageShow = async (showId: string, userId: string) => {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      venue: { include: { representatives: true } },
      createdByBand: { include: { members: true } }
    }
  });

  if (!show) return false;

  // Venue representative check
  const venueRep = show.venue?.representatives.some(r => r.userId === userId);

  // Check if user is a member of the band that created the show
  const isCreatorBandMember = show.createdByBand?.members.some(m => m.userId === userId);

  return venueRep || isCreatorBandMember;
};



// READ

export const getShows = async (req: Request, res: Response) => {
  try {
    const shows = await prisma.show.findMany({
      where: { deletedAt: null },
      include: {
        venue: true,
        tour: true,
        bands: { include: { band: true } }
      }
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
    const { date, city, state, country, venueId, tourId, bandIds = [], startTime, endTime, status, notes, creatorBandId }: {
      date: string
      city: string
      state: string
      country: string
      venueId?: string
      venueName?: string
      venueAddress: string
      tourId?: string
      bandIds?: string[]
      startTime?: string
      endTime?: string
      status: ShowStatus
      notes?: string
      creatorBandId: string
    } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!creatorBandId) return res.status(400).json({ error: "creatorBandId is required" });

    // Check that user is in the creator band
    const membership = await prisma.bandMember.findFirst({ where: { bandId: creatorBandId, userId } });
    if (!membership) return res.status(403).json({ error: "You must be a member of the creator band" });

    const show = await prisma.$transaction(async (tx) => {
      // Create show with creator band
      const newShow = await tx.show.create({
        data: {
          date: new Date(date),
          city,
          state,
          country,
          tourId,
          startTime,
          endTime,
          status,
          notes,
          createdByBandId: creatorBandId
        }
      });

      if (bandIds.length) {
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

    const { date, city, state, country, venueId, tourId, addBandId, removeBandId, startTime, endTime, status, notes } = req.body;

    const updatedShow = await prisma.$transaction(async (tx) => {
      await tx.show.update({
        where: { id },
        data: { date: date ? new Date(date) : undefined, city, state, country, venueId, tourId, startTime, endTime, status, notes }
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


