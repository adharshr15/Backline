import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { BandRole, InviteStatus } from '../../generated/prisma/client'
import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware';
import { request } from 'node:http';

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

export const getMyShowInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Find all bands the user is a member of
    const userBands = await prisma.bandMember.findMany({
      where: { userId },
      select: { bandId: true },
    });

    const bandIds = userBands.map((b) => b.bandId);
    if (!bandIds.length) return res.json([]); // user in no bands

    // Fetch show invites for those bands
    const invites = await prisma.showInvite.findMany({
      where: { bandId: { in: bandIds }, status: InviteStatus.PENDING },
      include: {
        band: { select: { id: true, name: true } },
        show: { include: { venue: true, tour: true, bands: { include: { band: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(invites);
  } catch (error: any) {
    console.error("Prisma getMyShowInvites error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const createBand = async (req: AuthRequest, res: Response) => {
  try {
    const { name, genre, city, state, country, members } = req.body;
    const creatorId = req.user?.userId;

    if (!creatorId) return res.status(401).json({ error: "Unauthorized" });
    if (!name) return res.status(400).json({ error: "Band name is required." });

    const accountType = "BAND";

    // Ensure at least the creator is a member
    const band = await prisma.band.create({
      data: {
        name, genre, city, state, country, accountType,
        members: {
          create: [
            {
              userId: creatorId
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
        if (m.userId && m.userId !== creatorId) {
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

    const { name, genre, city, state, country, updateRole, inviteMemberId, removeMemberId }:
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
      const isManager = requesterMembership?.role === "MANAGER" || requesterMembership?.role === "MEMBER";

      // Force remove member if requester is manager
      if (removeMemberId) {
        if (!isManager) throw new Error("Only managers can remove members");

        await tx.bandMember.delete({
          where: { userId_bandId: { userId: removeMemberId, bandId } }
        });
      }

      // Invite new member if provided
      if (inviteMemberId) {
        if (!isManager) throw new Error("Only managers can add members");

        const existingMember = await tx.bandMember.findUnique({
          where: { userId_bandId: { userId: inviteMemberId, bandId } }
        });
        const existingInvite = await tx.bandInvite.findFirst({
          where: {
            bandId,
            userId: inviteMemberId,
            status: "PENDING"
          }
        });

        if (!existingMember && !existingInvite) {
          await tx.bandInvite.create({ data: { bandId, userId: inviteMemberId } });
        }
      }

      // Update member's role if provided
      if (updateRole) {
        if (!isManager) throw new Error("Only managers can update roles");

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

export const respondToShowInvite = async (req: AuthRequest, res: Response) => {
  try {
    const showInviteId = req.params.id as string;
    const { action } = req.body; // ACCEPT or DECLINE
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch the invite and band members
    const invite = await prisma.showInvite.findUnique({
      where: { id: showInviteId },
      include: { band: { include: { members: true } } },
    });

    if (!invite) return res.status(404).json({ error: "Invite not found" });

    if (!invite.bandId) {
      return res.status(400).json({ error: "This invite is not for a band" });
    }

    const bandId = invite.bandId;

    // Check if current user is in the band
    const isBandMember = invite.band?.members.some((m) => m.userId === userId);
    if (!isBandMember) return res.status(403).json({ error: "Not a band member" });

    if (action === "ACCEPT") {
      // Add band to the show
      await prisma.$transaction(async (tx) => {
        await tx.showBand.create({
          data: {
            showId: invite.showId,
            bandId: bandId
          }
        });

        // Update invite status
        await tx.showInvite.update({
          where: { id: showInviteId },
          data: { status: InviteStatus.ACCEPTED },
        });
      })

    } else if (action === "DECLINE") {
      await prisma.showInvite.update({
        where: { id: showInviteId },
        data: { status: InviteStatus.DECLINED },
      });
    } else {
      return res.status(400).json({ error: "Invalid action, must be ACCEPT or DECLINE" });
    }

    // Return updated show 
    const updatedShow = await prisma.show.findUnique({
      where: { id: invite.showId },
      include: { bands: true },
    });

    res.status(200).json(updatedShow);
  } catch (error: any) {
    console.error("Prisma respondToShowInvite error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const respondToTourInvite = async (req: AuthRequest, res: Response) => {
  try {
    const tourInviteId = req.params.id as string;
    const { action } = req.body; // ACCEPT or DECLINE
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch the invite and band members
    const invite = await prisma.tourInvite.findUnique({
      where: { id: tourInviteId },
      include: { band: { include: { members: true } } },
    });

    if (!invite) return res.status(404).json({ error: "Invite not found" });

    // Check if current user is in the band
    const isBandMember = invite.band.members.some((m) => m.userId === userId);
    if (!isBandMember) return res.status(403).json({ error: "Not a band member" });

    if (action === "ACCEPT") {
      // Add band to the tour
      await prisma.$transaction(async (tx) => {
        await tx.bandTour.create({
          data: {
            tourId: invite.tourId,
            bandId: invite.bandId,
          },
        });

        // Update invite status
        await tx.tourInvite.update({
          where: { id: tourInviteId },
          data: { status: InviteStatus.ACCEPTED },
        });
      })

    } else if (action === "DECLINE") {
      await prisma.tourInvite.update({
        where: { id: tourInviteId },
        data: { status: InviteStatus.DECLINED },
      });
    } else {
      return res.status(400).json({ error: "Invalid action, must be ACCEPT or DECLINE" });
    }

    // Return updated show 
    const updatedTour = await prisma.tour.findUnique({
      where: { id: invite.tourId },
      include: { bands: true },
    });

    res.status(200).json(updatedTour);
  } catch (error: any) {
    console.error("Prisma respondToTourInvite error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const deleteBand = async (req: AuthRequest, res: Response) => {
  try {
    const bandId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await prisma.$transaction(async (tx) => {

      // Check if requester is a manager of this band
      const membership = await tx.bandMember.findFirst({
        where: {
          bandId,
          userId
        }
      });

      if (!membership) {
        throw new Error("Not a member of this band");
      }

      if (membership.role !== "MANAGER") {
        throw new Error("Only band managers can delete the band");
      }

      // Remove relationships
      await tx.bandMember.deleteMany({ where: { bandId } });
      await tx.bandTour.deleteMany({ where: { bandId } });
      await tx.showBand.deleteMany({ where: { bandId } });

      // Soft delete band
      await tx.band.update({
        where: { id: bandId },
        data: { deletedAt: new Date() }
      });

    });

    res.json({ message: "Band soft-deleted successfully" });

  } catch (error: any) {
    console.error("Prisma deleteBand error:", error.message);

    if (error.message === "Not a member of this band") {
      return res.status(403).json({ error: error.message });
    }

    if (error.message === "Only band managers can delete the band") {
      return res.status(403).json({ error: error.message });
    }

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Band not found" });
    }

    res.status(500).json({ error: error.message });
  }
};