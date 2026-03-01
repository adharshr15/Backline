import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { BandRole } from '../../generated/prisma/client'
import { Request, Response } from 'express'

export const getBands = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const bands = await prisma.band.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        genre: true,
        city: true,
        state: true,
        country: true,
        createdAt: true
      }
    });

    res.json(bands)
  } catch (error: any) {
    console.error("Prisma getBands error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const getBandById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const band = await prisma.band.findUnique({
      where: { id },
      include: {
        members: { include: { user: true } },
        tours: false
      }
    })

    if (!band) {
      return res.status(404).json({ error: "Band not found" })
    }

    res.json(band)
  } catch (error: any) {
    console.error("Prisma getBandById error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const createBand = async (req: Request, res: Response) => {
  try {
    const { name, genre, city, state, country, members } = req.body

    /* 
     * Members is an array of UserIds and Roles
     * members_example = [{"userId": "userid1", "role": "MEMBER"}, {"userId": "userid2", "role": "MANAGER"}] 
     */

    if (!name) { res.status(400).json({ error: "Band name is required." }) }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        error: "Band must be created with at least one member."
      })
    }

    const band = await prisma.band.create({
      data: {
        name, genre, city, state, country,
        members: members ? { create: members } : undefined
      },
      include: {
        members: true,
        tours: true
      },
    })

    res.status(201).json(band)
  } catch (error: any) {
    console.error("Prisma createBand error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const updateBand = async (req: Request, res: Response) => {
  try {
    const bandId = req.params.id as string

    const { name, genre, city, state, country, addMemberId, removeMemberId, updateRole, addTourId, updateTourId, removeTourId }:
      {
        name?: string
        genre?: string
        city?: string
        state?: string
        country?: string
        addMemberId?: { userId: string; bandRole?: BandRole }
        removeMemberId?: string
        updateRole?: { userId: string; bandRole: BandRole }
        addTourId?: string
        updateTourId?: { id: string; name?: string }
        removeTourId?: string
      } = req.body

    const updatedBand = await prisma.$transaction(async (tx) => {
      const updateData: any = {}

      if (name) updateData.name = name;
      if (genre) updateData.genre = genre;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (country) updateData.country = country;

      // add user to band
      if (addMemberId) {
        await tx.bandMember.upsert({
          where: {
            userId_bandId: {
              userId: addMemberId.userId,
              bandId: bandId
            }
          },
          update: { role: addMemberId.bandRole || "MEMBER" },
          create: {
            userId: addMemberId.userId,
            bandId: bandId,
            role: addMemberId.bandRole || "MEMBER"
          }
        });
      }

      // remove user from band
      if (removeMemberId) {
        await tx.bandMember.deleteMany({
          where: {
            userId: removeMemberId,
            bandId: bandId
          }
        })
      }

      // update member's role
      if (updateRole) {
        await tx.bandMember.update({
          where: {
            userId_bandId: {
              userId: updateRole.userId,
              bandId: bandId
            }
          },
          data: {
            role: updateRole.bandRole
          }
        });
      }

      // add a tour to band
      if (addTourId) {
        await tx.tour.update({
          where: { id: addTourId },
          data: {
            bands: {
              connect: { id: bandId }
            }
          }
        });
      }

      // remove tour from band
      if (removeTourId) {
        await prisma.tour.update({
          where: { id: removeTourId },
          data: {
            bands: { disconnect: { id: bandId } }
          }
        });
      }

      const band = await tx.band.update({
        where: { id: bandId }, 
        data: updateData,
        include: {
          members: {
            include: { band: true }
          },
          tours: true
        }
      })

      return band;

    });

    res.status(200).json(updatedBand);


  } catch (error: any) {
    console.error(error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Band not found" })
    }

    res.status(500).json({ error: error.message })
  }
}

export const deleteBand = async (req: Request, res: Response) => {
  try {
    const bandId = req.params.id as string;

    await prisma.$transaction(async (tx) => {
      // Delete band members
      await tx.bandMember.deleteMany({ where: { bandId } });

      // Disconnect band from all tours it has
      const tours = await tx.tour.findMany({
        where: { bands: { some: { id: bandId } } },
        select: { id: true }
      });

      for (const tour of tours) {
        await tx.tour.update({
          where: { id: tour.id },
          data: { bands: { disconnect: { id: bandId } } }
        });
      }

      // Delete the band
      await tx.band.delete({ where: { id: bandId } });
    });

    res.json({ message: "Band deleted successfully" });
  } catch (error: any) {
    console.error("Prisma deleteBand error:", error.message);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Band not found" });
    }

    res.status(500).json({ error: error.message });
  }
};