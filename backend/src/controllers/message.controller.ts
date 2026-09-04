import { Response } from "express"
import { prisma } from "../lib/prisma"
import { AuthRequest } from "../middlewares/auth.middleware"
import { ParticipantType } from "../../generated/prisma/enums"

// Slim listing fields needed to render an in-message preview card.
export const listingPreviewSelect = {
  id: true, title: true, coverUrl: true, kind: true, price: true,
  openToTrades: true, status: true, category: true, city: true, state: true,
} as const;

// Shared message include: senders + optional attachment previews.
export const messageInclude = {
  senderUser:  { select: { id: true, name: true, profileImageUrl: true } },
  senderBand:  { select: { id: true, name: true, profileImageUrl: true } },
  senderVenue: { select: { id: true, name: true, profileImageUrl: true } },
  listing:     { select: listingPreviewSelect },
} as const;

// GET
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.id as string;
    const userId = req.user?.userId as string;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { senderType, senderId } = req.query as { senderType: ParticipantType; senderId: string };

    if (!senderType || !senderId) {
      return res.status(400).json({ error: "senderType and senderId are required" });
    }

    // validate participant type
    if (![ParticipantType.USER, ParticipantType.BAND, ParticipantType.VENUE].includes(senderType)) {
      return res.status(400).json({ error: "Invalid senderType" });
    }

    // authorization: validate requestor is user or in band/venue
    if (senderType === ParticipantType.USER) {
      if (senderId !== userId) return res.status(403).json({ error: "Forbidden" });
    }

    if (senderType === ParticipantType.BAND) {
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: senderId, userId },
      });
      if (!membership) return res.status(403).json({ error: "Not a member of this band" });
    }

    if (senderType === ParticipantType.VENUE) {
      const membership = await prisma.venueRepresentative.findFirst({
        where: { venueId: senderId, userId },
      });
      if (!membership) return res.status(403).json({ error: "Not a representative of this venue" });
    }

    // verify that  sender is in conversation
    let participantFilter: any = {};
    if (senderType === ParticipantType.USER) participantFilter = { userId: senderId };
    if (senderType === ParticipantType.BAND) participantFilter = { bandId: senderId };
    if (senderType === ParticipantType.VENUE) participantFilter = { venueId: senderId };

    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, ...participantFilter },
    });

    if (!participant) return res.status(403).json({ error: "Sender is not in this conversation" });

    // fetch all messages in chronological order
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      include: messageInclude,
    });

    return res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to get messages" });
  }
};

// CREATE
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.id as string
    const userId = req.user?.userId as string

    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const { content, senderType, senderId, listingId }: {
      content?: string;
      senderType: ParticipantType;
      senderId: string;
      listingId?: string;
    } = req.body

    const file = req.file as Express.Multer.File | undefined
    const imageUrl = file ? `/uploads/${file.filename}` : undefined

    if (!senderType || !senderId) {
      return res.status(400).json({ error: "senderType and senderId are required" })
    }

    // a message must carry text and/or an image
    if (!content?.trim() && !imageUrl) {
      return res.status(400).json({ error: "content or image is required" })
    }

    // validate senderType
    if (![ParticipantType.USER, ParticipantType.BAND, ParticipantType.VENUE].includes(senderType)) {
      return res.status(400).json({ error: "Invalid senderType" })
    }

    // verify requestor is authorized to send as this entity
    if (senderType === ParticipantType.USER && senderId !== userId) {
      return res.status(403).json({ error: "You cannot send as this user" })
    }

    if (senderType === ParticipantType.BAND) {
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: senderId, userId }
      })
      if (!membership) return res.status(403).json({ error: "You are not a member of this band" })
    }

    if (senderType === ParticipantType.VENUE) {
      const membership = await prisma.venueRepresentative.findFirst({
        where: { venueId: senderId, userId }
      })
      if (!membership) return res.status(403).json({ error: "You are not a representative of this venue" })
    }

    // verify sender is a participant in the conversation
    const participantFilter: any = {}
    if (senderType === ParticipantType.USER) participantFilter.userId = senderId
    if (senderType === ParticipantType.BAND) participantFilter.bandId = senderId
    if (senderType === ParticipantType.VENUE) participantFilter.venueId = senderId

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        ...participantFilter
      }
    })

    if (!participant) return res.status(403).json({ error: "Sender is not a participant in this conversation" })

    // validate optional listing attachment
    if (listingId) {
      const listing = await prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } })
      if (!listing) return res.status(400).json({ error: "Attached listing not found" })
    }

    // create message
    const messageData: any = {
      conversationId,
      content: content?.trim() ?? ""
    }
    if (senderType === ParticipantType.USER) messageData.senderUserId = senderId
    if (senderType === ParticipantType.BAND) messageData.senderBandId = senderId
    if (senderType === ParticipantType.VENUE) messageData.senderVenueId = senderId
    if (listingId) messageData.listingId = listingId
    if (imageUrl) messageData.imageUrl = imageUrl

    const message = await prisma.message.create({ data: messageData, include: messageInclude })

    // update conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    })

    return res.status(201).json(message)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: "Failed to send message", content: req.body.content })
  }
}