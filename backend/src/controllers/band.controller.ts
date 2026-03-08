import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { BandRole } from '../../generated/prisma/client'
import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware';

export const getBands = async (req: AuthRequest, res: Response) => {
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

export const getBandById = async (req: AuthRequest, res: Response) => {
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

export const createBand = async (req: AuthRequest, res: Response) => {
  try {
    const { name, genre, city, state, country, members } = req.body;
    const creatorId = req.user?.userId;

    if (!creatorId) return res.status(401).json({ error: "Unauthorized" });
    if (!name) return res.status(400).json({ error: "Band name is required." });

    // Ensure at least the creator is a member
    const band = await prisma.band.create({
      data: {
        name, genre, city, state, country, 
        members: {
          create: [
            {
              userId: creatorId,
              role: "MANAGER"
            }
          ]
        }
      },
      include: {
        members: { include: { user: true } },
        tours: { include: { tour: true } },
        shows: { include: { show: true } }
      }
    });

    // Send invites to any other users passed in `members`
    if (members && Array.isArray(members)) {
      for (const m of members) {
        if (m.userId !== creatorId) {
          await prisma.bandInvite.create({
            data: {
              bandId: band.id,
              userId: m.userId,
              status: 'PENDING'
            }
          });
        }
      }
    }

    res.status(201).json(band);
  } catch (error: any) {
    console.error("Prisma createBand error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const updateBand = async (req: AuthRequest, res: Response) => {
  try {
    const bandId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, genre, city, state, country, updateRole, inviteMemberId, removeMemberId } : 
    {
      name?: string;
      genre?: string;
      city?: string;
      state?: string;
      country?: string;
      updateRole?: { userId: string; bandRole: BandRole };
      inviteMemberId?: string;
      removeMemberId?: string;
    } = req.body;

    const updatedBand = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (genre) updateData.genre = genre;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (country) updateData.country = country;

      // Check if requester is a manager
      const requesterMembership = await tx.bandMember.findUnique({
        where: { userId_bandId: { userId, bandId } }
      });
      const isManager = requesterMembership?.role === "MANAGER";

      // Force remove member if requester is manager
      if (removeMemberId) {
        if (!isManager) return res.status(403).json({ error: "Only managers can remove members" });

        await tx.bandMember.delete({
          where: { userId_bandId: { userId: removeMemberId, bandId } }
        });
      }

      // Add new member if provided
      if (inviteMemberId) {
        if (!isManager) return res.status(403).json({ error: "Only managers can add members" });

        const existingMember = await tx.bandMember.findUnique({
          where: { userId_bandId: { userId: inviteMemberId, bandId } }
        });
        const existingInvite = await tx.bandInvite.findUnique({
          where: { bandId_userId: { bandId, userId: inviteMemberId } }
        });

        if (!existingMember && !existingInvite) {
          await tx.bandInvite.create({ data: { bandId, userId: inviteMemberId } });
        }
      }

      // Update member's role if provided
      if (updateRole) {
        await tx.bandMember.update({
          where: { userId_bandId: { userId: updateRole.userId, bandId } },
          data: { role: updateRole.bandRole }
        });
      }

      const band = await tx.band.update({
        where: { id: bandId },
        data: updateData,
        include: {
          members: true,
          tours: { include: { tour: true } },
          shows: { include: { show: true } }
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
    if (error.code === "P2025") return res.status(404).json({ error: "Band not found" });
    res.status(500).json({ error: error.message });
  }
};

export const respondToInvite = async (req: AuthRequest, res: Response) => {
  const { action } = req.body;
  const bandId = req.params.id as string;

  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  const invite = await prisma.bandInvite.findUnique({
    where: {
      bandId_userId: { bandId, userId: req.user.userId }
    }
  });

  if (!invite) return res.status(400).json({ error: "Invite not found" });

  if (action === "ACCEPT") {
    await prisma.bandMember.create({
      data: {
        userId: req.user.userId,
        bandId,
        role: "MEMBER"
      }
    });
  }

  // Remove invite whether ACCEPT or DECLINE
  await prisma.bandInvite.delete({ where: { id: invite.id } });

  const band = await prisma.band.findUnique({
    where: { id: bandId },
    include: { members: true }
  });

  res.status(200).json(band);
};

export const deleteBand = async (req: AuthRequest, res: Response) => {
  try {
    const bandId = req.params.id as string;
    const creatorId = req.user?.userId;

    if (!creatorId) return res.status(401).json({ error: "Unauthorized" });

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