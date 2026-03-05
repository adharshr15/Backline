import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// READ
export const getTours = async (req: Request, res: Response) => {
  try {
    const tours = await prisma.tour.findMany({
      where: { deletedAt: null },
      include: { bands: true, shows: true }
    });
    res.json(tours);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const getTourById = async (req: Request, res: Response) => {
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
    res.status(500).json({ error: error.message });
  }
};

// CREATE
export const createTour = async (req: Request, res: Response) => {
  try {
    const { name, startDate, endDate, bandIds } = req.body;

    if (!name) { return res.status(400).json({ error: "Tour name is required." }); }

    const tour = await prisma.tour.create({
      data: {
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        bands: bandIds?.length
          ? {
              create: bandIds.map((bandId: string) => ({ bandId }))
            }
          : undefined
      },
      include: { bands: true }
    });

    res.status(201).json(tour);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};



// UPDATE
export const updateTour = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, startDate, endDate, addBandIds, removeBandIds } = req.body;

    const updatedTour = await prisma.$transaction(async (tx) => {
      // Update main fields
      const tour = await tx.tour.update({
        where: { id },
        data: {
          name,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        },
        include: { bands: true }
      });

      // Add bands
      if (addBandIds?.length) {
        for (const bandId of addBandIds) {
          await tx.bandTour.upsert({
            where: { bandId_tourId: { bandId, tourId: id } },
            create: { bandId, tourId: id },
            update: {}
          });
        }
      }

      // Remove bands
      if (removeBandIds?.length) {
        await tx.bandTour.deleteMany({
          where: { tourId: id, bandId: { in: removeBandIds } }
        });
      }

      return tour;
    });

    res.json(updatedTour);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") return res.status(404).json({ error: "Tour not found" });
    res.status(500).json({ error: error.message });
  }
};

// DELETE 
export const deleteTour = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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
    res.status(500).json({ error: error.message });
  }
};