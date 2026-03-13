import { Request, Response } from "express"
import { prisma } from "../lib/prisma"
import { userSafeSelect } from "../lib/prismaSelects"
import { AuthRequest } from "../middlewares/auth.middleware"

// GET
export const getSentMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string
    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderUserId: userId },
          {
            senderBand: {
              members: { some: { userId } }
            }
          },
          {
            senderVenue: {
              representatives: { some: { userId } }
            }
          }
        ]
      },
      include: {
        senderUser: { select: userSafeSelect },
        senderBand: true,
        senderVenue: true,
      },
      orderBy: { createdAt: "desc" },
    })

    res.json(messages)
  } catch (error: any) {
    console.error("getSentMessages error:", error.message)
    res.status(500).json({ error: "Internal server error" })
  }
}

// CREATE
export const createMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const { content, conversationId, senderType, senderId, recipientType, recipientId }:
      {
        content: string
        conversationId?: string
        senderType: string
        senderId: string
        recipientType?: string
        recipientId?: string
      } = req.body

    if (!content) return res.status(400).json({ error: "Empty Message" })
    if ((!conversationId) && !(recipientId && recipientType)) return res.status(400).json({ error: "Either conversation or recipient weren't specified" })
    if (!senderType || !senderId) return res.status(400).json({ error: "Missing sender information"})


    let senderData: any = {}

    // Authorize Sender
    if (senderType === "USER") {
      if (senderId !== userId) return res.status(403).json({ error: "Cannot send as another user" })
      senderData.senderUserId = senderId
    } else if (senderType === "BAND") {
      const membership = await prisma.bandMember.findFirst({ where: { bandId: senderId, userId } })
      if (!membership) return res.status(403).json({ error: "Not a member of this band" })
      senderData.senderBandId = senderId
    } else if (senderType === "VENUE") {
      const rep = await prisma.venueRepresentative.findFirst({ where: { venueId: senderId, userId } })
      if (!rep) return res.status(403).json({ error: "Not a representative of this venue" })
      senderData.senderVenueId = senderId
    } else {
      return res.status(400).json({ error: "Invalid senderType" })
    }



    // If conversation exists, add message to conversation
    if (conversationId) {
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          OR: [
            { userId: senderData.senderUserId },
            { bandId: senderData.senderBandId },
            { venueId: senderData.senderVenueId }
          ]
        }
      })

      if (!participant) {
        return res.status(403).json({ error: "Sender not part of this conversation" })
      }

      const message = await prisma.message.create({
        data: {
          content,
          conversationId,
          ...senderData
        },
        include: {
          senderUser: { select: userSafeSelect },
          senderBand: true,
          senderVenue: true
        }
      })

      return res.status(201).json(message)
    }

    // If conversation doesnt exist, send conversation invite
    const inviteData: any = {
      message: content,
      ...senderData
    }

    // Validate Recipient exists
    if (recipientType === "USER") {
      const user = await prisma.user.findUnique({ where: { id: recipientId } })
      if (!user) return res.status(400).json({ error: "Recipient user not found" })

      inviteData.recipientUserId = recipientId

    } else if (recipientType === "BAND") {
      const band = await prisma.band.findUnique({ where: { id: recipientId } })
      if (!band) return res.status(400).json({ error: "Recipient band not found" })

      inviteData.recipientBandId = recipientId

    } else if (recipientType === "VENUE") {
      const venue = await prisma.venue.findUnique({ where: { id: recipientId } })
      if (!venue) return res.status(400).json({ error: "Recipient venue not found" })

      inviteData.recipientVenueId = recipientId

    } else {
      return res.status(400).json({ error: "Invalid recipientType" })
    }


    const invite = await prisma.conversationInvite.create({
      data: inviteData,
      include: {
        senderUser: { select: userSafeSelect },
        senderBand: true,
        senderVenue: true
      }
    })

    res.status(201).json({ invite, notice: "Conversation invite created since conversation did not exist" })

  } catch (error: any) {
    console.error("createMessage error:", error.message)
    res.status(500).json({ error: "Internal server error" })
  }
}

// DELETE
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string
    const messageId = req.params.id as string

    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const message = await prisma.message.findUnique({ where: { id: messageId } })
    if (!message) return res.status(404).json({ error: "Message not found" })

    let authorized = false

    if (message.senderUserId === userId) authorized = true

    if (message.senderBandId) {
      const member = await prisma.bandMember.findFirst({ where: { bandId: message.senderBandId, userId } })
      if (member) authorized = true
    }

    if (message.senderVenueId) {
      const rep = await prisma.venueRepresentative.findFirst({ where: { venueId: message.senderVenueId, userId } })
      if (rep) authorized = true
    }

    if (!authorized) return res.status(403).json({ error: "Not authorized to delete this message" })

    await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } })

    res.json({ message: "Message soft deleted successfully" })
  } catch (error: any) {
    console.error("deleteMessage error:", error.message)
    res.status(500).json({ error: "Internal server error" })
  }
}