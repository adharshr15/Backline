import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { BandRole } from '../../generated/prisma/client'
import { Request, Response } from 'express'

export const getBands = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const bands = await prisma.band.findMany({
      where: {
        deletedAt: null
      },
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
      where: { id, deletedAt: null },
      include: {
        members: { include: { user: true } },
        tours: { include: { tour: true } },
        shows: { include: { show: { include: { venue: true, tour: true } } } }
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
        members: {
          create: members.map((m: any) => ({
            userId: m.userId,
            role: m.role ?? "MEMBER"
          }))
        }
      },
      include: {
        members: { include: { user: true } },
        tours: { include: { tour: true } },
        shows: { include: { show: { include: { venue: true } } } }
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

    const { name, genre, city, state, country, addMemberId, removeMemberId, updateRole }:
      {
        name?: string
        genre?: string
        city?: string
        state?: string
        country?: string
        addMemberId?: { userId: string; bandRole?: BandRole }
        removeMemberId?: string
        updateRole?: { userId: string; bandRole: BandRole }
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
        });
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

      const band = await tx.band.update({
        where: { id: bandId },
        data: updateData,
        include: {
          members: true,
          tours: {
            include: {
              tour: true
            }
          },
          shows: {
            include: {
              show: true
            }
          }
        }
      });

      return {
        ...band,
        tours: band.tours.map(bt => bt.tour),
        shows: band.shows.map(sb => sb.show)
      };

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
      // Remove relationships (hard delete join rows only)
      await tx.bandMember.deleteMany({ where: { bandId } });
      await tx.bandTour.deleteMany({ where: { bandId } });
      await tx.showBand.deleteMany({ where: { bandId } });

      // Soft delete band
      const band = await tx.band.update({
        where: { id: bandId },
        data: { deletedAt: new Date() }
      });

      return band;
    });

    res.json({ message: "Band soft-deleted successfully" });
  } catch (error: any) {
    console.error("Prisma deleteBand error:", error.message);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Band not found" });
    }

    res.status(500).json({ error: error.message });
  }
};