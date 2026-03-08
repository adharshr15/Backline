import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { InviteStatus } from "../../generated/prisma/client";


// Helper: Check if user manages show
const canManageShow = async (showId: string, userId: string) => {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      venue: { include: { representatives: true } },
      bands: { include: { band: { include: { members: true } } } }
    }
  });

  if (!show) return false;

  const venueRep = show.venue?.representatives.some(r => r.userId === userId);

  const bandMember = show.bands.some(sb =>
    sb.band.members.some(m => m.userId === userId)
  );

  return venueRep || bandMember;
};



/*
================================
PUBLIC READ
================================
*/

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



/*
================================
CREATE SHOW (PRIVATE)
================================
*/

export const createShow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      date,
      city,
      state,
      country,
      venueId,
      tourId,
      bandIds = [],
      status,
      notes
    } = req.body;

    const show = await prisma.$transaction(async (tx) => {

      // Create show
      const newShow = await tx.show.create({
        data: {
          date: new Date(date),
          city,
          state,
          country,
          venueId,
          tourId,
          status,
          notes
        }
      });

      if (!bandIds.length) return newShow;

      // Find which bands the user belongs to
      const memberships = await tx.bandMember.findMany({
        where: {
          userId,
          bandId: { in: bandIds }
        }
      });

      const userBandIds = memberships.map(m => m.bandId);

      const bandsUserIsIn = bandIds.filter((id: string) => userBandIds.includes(id));
      const bandsUserIsNotIn = bandIds.filter((id: string) => !userBandIds.includes(id));

      // Automatically add bands the user belongs to
      if (bandsUserIsIn.length) {
        await tx.showBand.createMany({
          data: bandsUserIsIn.map((bandId: string) => ({
            bandId,
            showId: newShow.id
          }))
        });
      }

      // Send invites to bands the user does not belong to
      if (bandsUserIsNotIn.length) {
        await tx.showInvite.createMany({
          data: bandsUserIsNotIn.map((bandId: string) => ({
            bandId,
            showId: newShow.id,
            status: "PENDING"
          }))
        });
      }

      return newShow;
    });

    const fullShow = await prisma.show.findUnique({
      where: { id: show.id },
      include: {
        venue: true,
        tour: true,
        bands: {
          include: { band: true }
        },
        showInvites: {
          include: { band: true }
        }
      }
    });

    res.status(201).json(fullShow);

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



/*
================================
UPDATE SHOW (PRIVATE)
================================
*/

export const updateShow = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageShow(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const {
      date,
      city,
      state,
      country,
      venueId,
      tourId,
      addBandIds,
      removeBandIds,
      status,
      notes
    } = req.body;

    const updatedShow = await prisma.$transaction(async (tx) => {

      await tx.show.update({
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
        }
      });

      if (addBandIds?.length) {
        for (const bandId of addBandIds) {
          await tx.showBand.upsert({
            where: { bandId_showId: { bandId, showId: id } },
            create: { bandId, showId: id },
            update: {}
          });
        }
      }

      if (removeBandIds?.length) {
        await tx.showBand.deleteMany({
          where: { showId: id, bandId: { in: removeBandIds } }
        });
      }

      return tx.show.findUnique({
        where: { id },
        include: {
          venue: true,
          tour: true,
          bands: { include: { band: true } }
        }
      });
    });

    res.json(updatedShow);

  } catch (error: any) {
    if (error.code === "P2025")
      return res.status(404).json({ error: "Show not found" });

    res.status(500).json({ error: error.message });
  }
};



/*
================================
DELETE SHOW (PRIVATE)
================================
*/

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



/*
================================
INVITE BAND TO SHOW
================================
*/

export const inviteBandToShow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const showId = req.params.id as string;
    const { bandId } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageShow(showId, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const existingInvite = await prisma.showInvite.findUnique({
      where: { showId_bandId: { showId, bandId } }
    });

    if (existingInvite)
      return res.status(400).json({ error: "Band already invited" });

    const invite = await prisma.showInvite.create({
      data: { showId, bandId }
    });

    res.status(201).json(invite);

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



/*
================================
RESPOND TO SHOW INVITE
================================
*/

export const respondToShowInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const inviteId = req.params.id as string;
    const { action } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const invite = await prisma.showInvite.findUnique({
      where: { id: inviteId },
      include: {
        band: { include: { members: true } }
      }
    });

    if (!invite) return res.status(404).json({ error: "Invite not found" });

    const isBandMember = invite.band.members.some(m => m.userId === userId);
    if (!isBandMember)
      return res.status(403).json({ error: "Not a band member" });

    if (action === "ACCEPT") {

      await prisma.$transaction(async (tx) => {

        await tx.showBand.create({
          data: {
            showId: invite.showId,
            bandId: invite.bandId
          }
        });

        await tx.showInvite.update({
          where: { id: inviteId },
          data: { status: InviteStatus.ACCEPTED }
        });

      });

    } else {

      await prisma.showInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.DECLINED }
      });

    }

    res.json({ message: "Invite response recorded" });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



/*
================================
GET MY SHOW INVITES
================================
*/

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