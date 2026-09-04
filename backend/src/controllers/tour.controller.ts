import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from '../middlewares/auth.middleware';

const canManageTour = async (tourId: string, userId: string) => {
  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
    include: {
      createdByBand: { include: { members: true } }
    }
  });

  if (!tour) return false;

  const isCreatorBandMember = tour.createdByBand?.members.some(m => m.userId === userId);

  return isCreatorBandMember;
}

// READ
export const getTours = async (req: AuthRequest, res: Response) => {
  try {
    const tours = await prisma.tour.findMany({
      where: { deletedAt: null },
      include: { bands: true, shows: true }
    });
    res.json(tours);
  } catch (error: any) {
    console.error(error);
    fail(res, error, "tour");
  }
};

export const getTourById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const tour = await prisma.tour.findFirst({
      where: { id, deletedAt: null },
      include: { bands: true, shows: true }
    });
    if (!tour) return res.status(404).json({ error: "Tour not found" });
    res.json(tour);
  } catch (error: any) {
    console.error(error);
    fail(res, error, "tour");
  }
};


// CREATE
export const createTour = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { name, startDate, endDate, bandIds, creatorBandId }: {
      name: string
      startDate?: string
      endDate?: string
      bandIds: string[]
      creatorBandId: string
    } = req.body

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!creatorBandId) return res.status(400).json({ error: "creatorBandId is required" });

    // Check that user is in the creator band
    const membership = await prisma.bandMember.findFirst({ where: { bandId: creatorBandId, userId } });
    if (!membership) return res.status(403).json({ error: "You must be a member of the creator band" });

    if (!name) { return res.status(400).json({ error: "Tour name is required." }); }

    const tour = await prisma.$transaction(async (tx) => {
      const newTour = await tx.tour.create({
        data: {
          name,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          createdByBandId: creatorBandId
        }
      });

      if (bandIds.length) {
        // Automatically add the creator band to the show
        await tx.bandTour.create({
          data: {
            bandId: creatorBandId,
            tourId: newTour.id
          }
        });

        // Invite the rest of the specified bands
        const uniqueBandIds = [...new Set(bandIds)];
        const bandsToInvite = uniqueBandIds.filter(id => id !== creatorBandId);

        if (bandsToInvite.length) {
          await tx.tourInvite.createMany({
            data: bandsToInvite.map((bandId: string) => ({
              bandId,
              tourId: newTour.id,
              status: "PENDING"
            }))
          });
        }
      }

      return newTour;
    });

    const fullTour = await prisma.tour.findUnique({
      where: { id: tour.id },
      include: {
        shows: true,
        bands: { include: { band: true } },
        tourInvites: { include: { band: true } }
      }
    });


    res.status(201).json(fullTour);
  } catch (error: any) {
    console.error(error);
    fail(res, error, "tour");
  }
};

// UPDATE
export const updateTour = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId as string;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageTour(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const { name, startDate, endDate, addBandId, removeBandId } = req.body;

    const updatedTour = await prisma.$transaction(async (tx) => {
      await tx.tour.update({
        where: { id },
        data: {
          name: name || undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        }
      });

      // Add band invites
      if (addBandId) {
        const existingInvite = await tx.tourInvite.findFirst({
          where: {
            tourId: id,
            bandId: addBandId,
            status: "PENDING"
          }
        });

        if (!existingInvite) {
          await tx.tourInvite.create({
            data: {
              tourId: id,
              bandId: addBandId,
              status: "PENDING"
            }
          });
        }
      }

      // Remove band from tour. `deleteMany` keeps this idempotent — `delete` throws
      // P2025 when the band is not on the tour, which surfaced as a bogus 404.
      if (removeBandId) {
        await tx.bandTour.deleteMany({
          where: { bandId: removeBandId, tourId: id }
        });
        await tx.tourInvite.deleteMany({
          where: { bandId: removeBandId, tourId: id }
        });
      }

      return tx.tour.findUnique({
        where: { id },
        include: {
          bands: { include: { band: true } },
          tourInvites: { include: { band: true } },
          createdByBand: { include: { members: true } }
        }
      })
    });

    res.json(updatedTour);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") return res.status(404).json({ error: "Tour not found" });
    fail(res, error, "tour");
  }
};

// DELETE 
export const deleteTour = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId as string;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageTour(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    await prisma.$transaction(async (tx) => {
      // Remove all band relationships
      await tx.bandTour.deleteMany({ where: { tourId: id } });

      // Optionally nullify venue in shows
      await tx.show.updateMany({ where: { tourId: id }, data: { tourId: null } });

      // Soft delete tour
      await tx.tour.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    res.json({ message: "Tour soft-deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") return res.status(404).json({ error: "Tour not found" });
    fail(res, error, "tour");
  }
};