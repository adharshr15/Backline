import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// READ 
export const getShows = async (req: Request, res: Response) => {
  try {
    const shows = await prisma.show.findMany({
      where: { deletedAt: null },
      include: { bands: true, venue: true, tour: true }
    });
    res.json(shows);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const getShowById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const show = await prisma.show.findFirst({
      where: { id, deletedAt: null },
      include: { bands: true, venue: true, tour: true }
    });
    if (!show) return res.status(404).json({ error: "Show not found" });
    res.json(show);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// CREATE
export const createShow = async (req: Request, res: Response) => {
  try {
    const { date, city, state, country, venueId, tourId, bandIds, status, notes } = req.body;

    const show = await prisma.show.create({
      data: {
        date: new Date(date),
        city,
        state,
        country,
        venueId,
        tourId,
        status,
        notes,
        bands: bandIds?.length
          ? { create: bandIds.map((bandId: string) => ({ bandId })) }
          : undefined
      },
      include: { bands: true }
    });

    res.status(201).json(show);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE 
export const updateShow = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { date, city, state, country, venueId, tourId, addBandIds, removeBandIds, status, notes } = req.body;

    const updatedShow = await prisma.$transaction(async (tx) => {
      const show = await tx.show.update({
        where: { id },
        data: {
          date: date ? new Date(date) : undefined,
          city,
          state,
          country,
          venueId,
          tourId,
          status,
          notes
        },
        include: { bands: true }
      });

      // Add bands
      if (addBandIds?.length) {
        for (const bandId of addBandIds) {
          await tx.showBand.upsert({
            where: { bandId_showId: { bandId, showId: id } },
            create: { bandId, showId: id },
            update: {}
          });
        }
      }

      // Remove bands
      if (removeBandIds?.length) {
        await tx.showBand.deleteMany({
          where: { showId: id, bandId: { in: removeBandIds } }
        });
      }

      return show;
    });

    res.json(updatedShow);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") return res.status(404).json({ error: "Show not found" });
    res.status(500).json({ error: error.message });
  }
};

// DELETE 
export const deleteShow = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    await prisma.$transaction(async (tx) => {
      // Remove band relationships
      await tx.showBand.deleteMany({ where: { showId: id } });

      // Soft delete the show
      await tx.show.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    res.json({ message: "Show soft-deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") return res.status(404).json({ error: "Show not found" });
    res.status(500).json({ error: error.message });
  }
};