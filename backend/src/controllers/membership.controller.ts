import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

export const getMembershipInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const queryUserId = req.query.userId as string;

    if (!userId || userId !== queryUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [bandInvites, venueInvites] = await Promise.all([
      prisma.bandInvite.findMany({
        where: { userId: queryUserId, status: "PENDING" },
        include: {
          band: { select: { id: true, name: true, profileImageUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.venueInvite.findMany({
        where: { userId: queryUserId, status: "PENDING" },
        include: {
          venue: { select: { id: true, name: true, profileImageUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({ bandInvites, venueInvites });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch membership invites" });
  }
};

export const respondToBandInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const inviteId = req.params.id as string;
    const { userId: bodyUserId, action } = req.body as {
      userId: string;
      action: "ACCEPT" | "DECLINE";
    };

    if (!userId || userId !== bodyUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const invite = await prisma.bandInvite.findUnique({ where: { id: inviteId } });
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (invite.status !== "PENDING") return res.status(400).json({ error: "Invite already responded to" });

    if (action === "DECLINE") {
      await prisma.bandInvite.update({ where: { id: inviteId }, data: { status: "DECLINED" } });
      return res.json({ success: true });
    }

    // Fetch band name for system message
    const band = await prisma.band.findUnique({
      where: { id: invite.bandId },
      select: { name: true },
    });
    if (!band) return res.status(404).json({ error: "Band not found" });

    // ACCEPT
    let conversationId = "";

    await prisma.$transaction(async (tx) => {
      await tx.bandMember.upsert({
        where: { userId_bandId: { userId, bandId: invite.bandId } },
        create: { userId, bandId: invite.bandId, role: "MEMBER" },
        update: {},
      });

      const existing = await tx.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { bandId: invite.bandId } } },
            { participants: { some: { userId } } },
          ],
        },
      });

      let convId: string;
      if (existing) {
        convId = existing.id;
      } else {
        const conv = await tx.conversation.create({
          data: {
            participants: {
              create: [
                { participantType: "BAND", bandId: invite.bandId },
                { participantType: "USER", userId },
              ],
            },
          },
        });
        convId = conv.id;
      }

      await tx.message.create({
        data: {
          conversationId: convId,
          content: `You joined ${band.name}`,
          isSystemMessage: true,
        },
      });

      await tx.bandInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED" } });

      conversationId = convId;
    });

    res.json({ success: true, conversationId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to respond to band invite" });
  }
};

export const respondToVenueInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const inviteId = req.params.id as string;
    const { userId: bodyUserId, action } = req.body as {
      userId: string;
      action: "ACCEPT" | "DECLINE";
    };

    if (!userId || userId !== bodyUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const invite = await prisma.venueInvite.findUnique({ where: { id: inviteId } });
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (invite.status !== "PENDING") return res.status(400).json({ error: "Invite already responded to" });

    if (action === "DECLINE") {
      await prisma.venueInvite.update({ where: { id: inviteId }, data: { status: "DECLINED" } });
      return res.json({ success: true });
    }

    const venue = await prisma.venue.findUnique({
      where: { id: invite.venueId },
      select: { name: true },
    });
    if (!venue) return res.status(404).json({ error: "Venue not found" });

    let conversationId = "";

    await prisma.$transaction(async (tx) => {
      await tx.venueRepresentative.upsert({
        where: { userId_venueId: { userId, venueId: invite.venueId } },
        create: { userId, venueId: invite.venueId, role: "REPRESENTATIVE" },
        update: {},
      });

      const existing = await tx.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { venueId: invite.venueId } } },
            { participants: { some: { userId } } },
          ],
        },
      });

      let convId: string;
      if (existing) {
        convId = existing.id;
      } else {
        const conv = await tx.conversation.create({
          data: {
            participants: {
              create: [
                { participantType: "VENUE", venueId: invite.venueId },
                { participantType: "USER", userId },
              ],
            },
          },
        });
        convId = conv.id;
      }

      await tx.message.create({
        data: {
          conversationId: convId,
          content: `You joined ${venue.name}`,
          isSystemMessage: true,
        },
      });

      await tx.venueInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED" } });

      conversationId = convId;
    });

    res.json({ success: true, conversationId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to respond to venue invite" });
  }
};

export const leaveBand = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const bandId = req.params.id as string;
    const { userId: bodyUserId } = req.body as { userId: string };

    if (!userId || userId !== bodyUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bandMember.delete({ where: { userId_bandId: { userId, bandId } } });
      // Delete the invite record so re-inviting later creates a fresh pending invite
      await tx.bandInvite.deleteMany({ where: { userId, bandId } });
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Not a member" });
    console.error(error);
    res.status(500).json({ error: "Failed to leave band" });
  }
};

export const leaveVenue = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const venueId = req.params.id as string;
    const { userId: bodyUserId } = req.body as { userId: string };

    if (!userId || userId !== bodyUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.venueRepresentative.delete({ where: { userId_venueId: { userId, venueId } } });
      // Delete the invite record so re-inviting later creates a fresh pending invite
      await tx.venueInvite.deleteMany({ where: { userId, venueId } });
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Not a representative" });
    console.error(error);
    res.status(500).json({ error: "Failed to leave venue" });
  }
};
