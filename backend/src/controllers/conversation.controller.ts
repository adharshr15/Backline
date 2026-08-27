import { Response } from "express"
import { prisma } from "../lib/prisma"
import { AuthRequest } from "../middlewares/auth.middleware"
import { ParticipantType } from "../../generated/prisma/enums"
import { listingPreviewSelect } from "./message.controller"

export const getMyConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;

    if (!userId) { return res.status(401).json({ error: "Unauthorized" }); }

    const { senderType, senderId } = req.query as { senderType: ParticipantType; senderId: string };

    if (!senderType || !senderId) {
      return res.status(400).json({ error: "senderType and senderId are required" });
    }

    // validate participant type
    if (![ParticipantType.USER, ParticipantType.BAND, ParticipantType.VENUE].includes(senderType)) {
      return res.status(400).json({ error: "Invalid senderType" });
    }

    // authorization
    if (senderType === ParticipantType.USER) {
      if (senderId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    if (senderType === ParticipantType.BAND) {
      const membership = await prisma.bandMember.findFirst({
        where: {
          bandId: senderId,
          userId
        }
      });

      if (!membership) {
        return res.status(403).json({ error: "Not a member of this band" });
      }
    }

    if (senderType === ParticipantType.VENUE) {
      const membership = await prisma.venueRepresentative.findFirst({
        where: {
          venueId: senderId,
          userId
        }
      });

      if (!membership) {
        return res.status(403).json({ error: "Not a representative of this venue" });
      }
    }

    // participant filter
    let participantFilter: any = {};

    if (senderType === ParticipantType.USER) {
      participantFilter = { userId: senderId };
    } else if (senderType === ParticipantType.BAND) {
      participantFilter = { bandId: senderId };
    } else if (senderType === ParticipantType.VENUE) {
      participantFilter = { venueId: senderId };
    }

    // get conversations
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: participantFilter
        }
      },
      include: {
        participants: {
          include: {
            user:  { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
            band:  { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
            venue: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { listing: { select: listingPreviewSelect } }
        },
        invites: {
          where: { status: "PENDING" },
          include: {
            recipientUser:  { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
            recipientBand:  { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
            recipientVenue: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return res.status(201).json(conversations);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to get conversations" });
  }
};

export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const conversationId = req.params.id as string;
    if (!conversationId) return res.status(400).json({ error: "Conversation ID is required" });

    const { senderType, senderId } = req.query as { senderType: ParticipantType; senderId: string };

    if (!senderType || !senderId) {
      return res.status(400).json({ error: "senderType and senderId are required" });
    }

    // validate participant type
    if (![ParticipantType.USER, ParticipantType.BAND, ParticipantType.VENUE].includes(senderType)) {
      return res.status(400).json({ error: "Invalid senderType" });
    }

    // authorization checks
    if (senderType === ParticipantType.USER && senderId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (senderType === ParticipantType.BAND) {
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: senderId, userId }
      });
      if (!membership) return res.status(403).json({ error: "Not a member of this band" });
    }

    if (senderType === ParticipantType.VENUE) {
      const membership = await prisma.venueRepresentative.findFirst({
        where: { venueId: senderId, userId }
      });
      if (!membership) return res.status(403).json({ error: "Not a representative of this venue" });
    }

    // participant filter
    let participantFilter: any = {};
    if (senderType === ParticipantType.USER) participantFilter = { userId: senderId };
    if (senderType === ParticipantType.BAND) participantFilter = { bandId: senderId };
    if (senderType === ParticipantType.VENUE) participantFilter = { venueId: senderId };

    // fetch conversation and ensure sender is a participant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: participantFilter }
      },
      include: {
        participants: true,
        invites: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    if (!conversation) return res.status(404).json({ error: "Conversation not found or not accessible" });

    return res.status(200).json(conversation);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to get conversation" });
  }
};

export const createConversation = async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = req.user?.userId as string

    const { name, userIds = [], bandIds = [], venueIds = [], senderType, senderId, content, listingId }:
      {
        name?: string
        userIds: string[]
        bandIds: string[]
        venueIds: string[]
        senderType: ParticipantType
        senderId: string
        content?: string
        listingId?: string
      } = req.body

    // validate optional listing attachment
    if (listingId) {
      const listing = await prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } })
      if (!listing) return res.status(400).json({ error: "Attached listing not found" })
    }

    // determine sender field
    let senderField: any = {}
    let participantField: any = {}

    if (senderType === ParticipantType.USER) {
      senderField = { senderUserId: senderId }
    } else if (senderType === ParticipantType.BAND) {
      senderField = { senderBandId: senderId }
    } else if (senderType === ParticipantType.VENUE) {
      senderField = { senderVenueId: senderId }
    } else {
      return res.status(400).json({ error: "Invalid ParticipantType" })
    }

    if (senderType === ParticipantType.USER) {
      participantField = { userId: senderId }
    } else if (senderType === ParticipantType.BAND) {
      participantField = { bandId: senderId }
    } else if (senderType === ParticipantType.VENUE) {
      participantField = { venueId: senderId }
    } else {
      return res.status(400).json({ error: "Invalid ParticipantType" })
    }

    // create conversation with sender as participant
    const conversation = await prisma.conversation.create({
      data: {
        name,
        participants: {
          create: [
            {
              ...participantField,
              participantType: senderType
            }
          ]
        }
      },
      include: {
        participants: true,
        invites: true,
        messages: true
      }
    })

    // add initial message to conversation
    if (content) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content,
          ...senderField,
          ...(listingId ? { listingId } : {})
        }
      })
    }

    // create data for invites
    const inviteData = [
      ...userIds.map((userId: string) => ({
        conversationId: conversation.id,
        recipientUserId: userId,
        recipientBandId: null,
        recipientVenueId: null,
        message: content,
        ...senderField,
      })),

      ...bandIds.map((bandId: string) => ({
        conversationId: conversation.id,
        recipientUserId: null,
        recipientBandId: bandId,
        recipientVenueId: null,
        message: content,
        ...senderField,
      })),

      ...venueIds.map((venueId: string) => ({
        conversationId: conversation.id,
        recipientUserId: null,
        recipientBandId: null,
        recipientVenueId: venueId,
        message: content,
        ...senderField,
      })),
    ];

    // send invites
    if (inviteData.length > 0) {
      await prisma.conversationInvite.createMany({
        data: inviteData
      })
    }

    const fullConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        participants: true,
        invites: true
      }
    })

    res.status(201).json(fullConversation)

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to create conversation" })
  }
}


export const updateConversation = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const userId = req.user?.userId as string

    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const { name, senderType, senderId, addUserId, removeUserId, addBandId, removeBandId, addVenueId, removeVenueId, content } = req.body

    let participantField: any = {}
    let senderField: any = {}

    // check if user is sender
    if (senderType === ParticipantType.USER) {
      if (userId !== senderId) {
        return res.status(403).json({ error: "Cannot act as another user" })
      }

      participantField = { userId: senderId }
      senderField = { senderUserId: senderId }

    } else if (senderType === ParticipantType.BAND) {
      // check user is in sender band
      const bandMember = await prisma.bandMember.findFirst({
        where: {
          bandId: senderId,
          userId
        }
      })

      if (!bandMember) {
        return res.status(403).json({ error: "Not a member of this band" })
      }

      participantField = { bandId: senderId }
      senderField = { senderBandId: senderId }

    } else if (senderType === ParticipantType.VENUE) {
      // check user is in sender venue
      const venueRep = await prisma.venueRepresentative.findFirst({
        where: {
          venueId: senderId,
          userId
        }
      })

      if (!venueRep) {
        return res.status(403).json({ error: "Not a representative of this venue" })
      }

      participantField = { venueId: senderId }
      senderField = { senderVenueId: senderId }

    } else {
      return res.status(400).json({ error: "Invalid ParticipantType" })
    }

    // check if sender is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: id,
        ...participantField
      }
    })

    if (!participant) {
      return res.status(403).json({ error: "Sender is not part of this conversation" })
    }

    // update name
    if (name) {
      await prisma.conversation.update({
        where: { id },
        data: { name }
      })
    }

    // create invites
    const inviteData = [
      ...(addUserId ? [{
        conversationId: id,
        recipientUserId: addUserId,
        message: content,
        ...senderField
      }] : []),

      ...(addBandId ? [{
        conversationId: id,
        recipientBandId: addBandId,
        message: content,
        ...senderField
      }] : []),

      ...(addVenueId ? [{
        conversationId: id,
        recipientVenueId: addVenueId,
        message: content,
        ...senderField
      }] : [])
    ]

    if (inviteData.length > 0) {
      await prisma.conversationInvite.createMany({
        data: inviteData
      })
    }

    // remove
    if (removeUserId) {
      await prisma.conversationParticipant.deleteMany({
        where: {
          conversationId: id,
          userId: removeUserId
        }
      })
    }

    if (removeBandId) {
      await prisma.conversationParticipant.deleteMany({
        where: {
          conversationId: id,
          bandId: removeBandId
        }
      })
    }

    if (removeVenueId) {
      await prisma.conversationParticipant.deleteMany({
        where: {
          conversationId: id,
          venueId: removeVenueId
        }
      })
    }

    // return updated conversation
    const fullConversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
        invites: true
      }
    })

    return res.status(201).json(fullConversation)

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to update conversation" })
  }
}

export const respondToConversationInvite = async (req: AuthRequest, res: Response) => {
  try {
    const inviteId = req.params.id as string;
    const userId = req.user?.userId as string

    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const { participantType, participantId, action }: {
      participantType: ParticipantType;
      participantId: string;
      action: "ACCEPT" | "DECLINE";
    } = req.body;

    // validate participant type
    if (![ParticipantType.USER, ParticipantType.BAND, ParticipantType.VENUE].includes(participantType)) {
      return res.status(400).json({ error: "Invalid participant type" });
    }

    // validate action
    if (!["ACCEPT", "DECLINE"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    // fetch invite
    const invite = await prisma.conversationInvite.findUnique({
      where: { id: inviteId }
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    if (invite.status !== "PENDING") {
      return res.status(400).json({ error: "Invite already handled" });
    }

    const conversationId = invite.conversationId;
    if (!conversationId) {
      return res.status(400).json({ error: "No conversation ID" });
    }

    // validate recipient + authorization
    let isValidRecipient = false;

    // USER
    if (
      participantType === ParticipantType.USER &&
      invite.recipientUserId === participantId &&
      userId === participantId
    ) {
      isValidRecipient = true;
    }

    // BAND
    if (
      participantType === ParticipantType.BAND &&
      invite.recipientBandId === participantId
    ) {
      const membership = await prisma.bandMember.findFirst({
        where: {
          bandId: participantId,
          userId: userId
        }
      });

      if (membership) {
        isValidRecipient = true;
      }
    }

    // VENUE
    if (
      participantType === ParticipantType.VENUE &&
      invite.recipientVenueId === participantId
    ) {
      const rep = await prisma.venueRepresentative.findFirst({
        where: {
          venueId: participantId,
          userId: userId
        }
      });

      if (rep) {
        isValidRecipient = true;
      }
    }

    if (!isValidRecipient) {
      return res.status(403).json({ error: "Not authorized for this invite" });
    }

    // DECLINE flow (early return)
    if (action === "DECLINE") {
      await prisma.conversationInvite.update({
        where: { id: inviteId },
        data: { status: "DECLINED" }
      });

      return res.status(200).json({ message: "Invite declined" });
    }

    // ACCEPT flow

    // build participant field
    let participantField: any = {};
    if (participantType === ParticipantType.USER) {
      participantField = { userId: participantId };
    } else if (participantType === ParticipantType.BAND) {
      participantField = { bandId: participantId };
    } else if (participantType === ParticipantType.VENUE) {
      participantField = { venueId: participantId };
    }

    // prevent duplicates
    const existingParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        ...participantField
      }
    });

    if (existingParticipant) {
      // still mark invite accepted
      await prisma.conversationInvite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED" }
      });

      return res.status(200).json({ message: "Already a participant" });
    }

    // add participant
    await prisma.conversationParticipant.create({
      data: {
        conversationId,
        participantType,
        ...participantField
      }
    });

    // update invite
    await prisma.conversationInvite.update({
      where: { id: inviteId },
      data: { status: "ACCEPTED" }
    });

    // return updated conversation
    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        invites: true
      }
    });

    return res.status(200).json(updatedConversation);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to respond to invite" });
  }
};

export const getMyInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { senderType, senderId } = req.query as { senderType: ParticipantType; senderId: string };
    if (!senderType || !senderId) return res.status(400).json({ error: "senderType and senderId are required" });

    if (senderType === ParticipantType.USER && senderId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (senderType === ParticipantType.BAND) {
      const m = await prisma.bandMember.findFirst({ where: { bandId: senderId, userId } });
      if (!m) return res.status(403).json({ error: "Not a member of this band" });
    }
    if (senderType === ParticipantType.VENUE) {
      const m = await prisma.venueRepresentative.findFirst({ where: { venueId: senderId, userId } });
      if (!m) return res.status(403).json({ error: "Not a representative of this venue" });
    }

    const recipientFilter =
      senderType === ParticipantType.USER  ? { recipientUserId: senderId } :
      senderType === ParticipantType.BAND  ? { recipientBandId: senderId } :
                                             { recipientVenueId: senderId };

    const invites = await prisma.conversationInvite.findMany({
      where: { ...recipientFilter, status: "PENDING" },
      include: {
        senderUser:  { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
        senderBand:  { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
        senderVenue: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
        conversation: {
          select: {
            id: true,
            name: true,
            participants: {
              include: {
                user:  { select: { id: true, name: true } },
                band:  { select: { id: true, name: true } },
                venue: { select: { id: true, name: true } },
              }
            },
            invites: {
              where: { status: "PENDING" },
              include: {
                recipientUser:  { select: { id: true, name: true } },
                recipientBand:  { select: { id: true, name: true } },
                recipientVenue: { select: { id: true, name: true } },
              }
            }
          }
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(invites);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to get invites" });
  }
};

export const markConversationRead = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.id as string;
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { senderType, senderId } = req.body as { senderType: ParticipantType; senderId: string };

    let participantFilter: any = { conversationId };
    if (senderType === ParticipantType.USER)  participantFilter.userId  = senderId;
    if (senderType === ParticipantType.BAND)  participantFilter.bandId  = senderId;
    if (senderType === ParticipantType.VENUE) participantFilter.venueId = senderId;

    await prisma.conversationParticipant.updateMany({
      where: participantFilter,
      data: { lastReadAt: new Date() },
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to mark read" });
  }
};

export const leaveConversation = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.id as string;
    const userId = req.user?.userId as string;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { senderType, senderId } = { ...req.body, ...req.query } as { senderType: ParticipantType; senderId: string };

    // validate type
    if (![ParticipantType.USER, ParticipantType.BAND, ParticipantType.VENUE].includes(senderType)) {
      return res.status(400).json({ error: "Invalid senderType" });
    }

    // authorization
    if (senderType === ParticipantType.USER) {
      if (senderId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    if (senderType === ParticipantType.BAND) {
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: senderId, userId }
      });

      if (!membership) {
        return res.status(403).json({ error: "Not in band" });
      }
    }

    if (senderType === ParticipantType.VENUE) {
      const membership = await prisma.venueRepresentative.findFirst({
        where: { venueId: senderId, userId }
      });

      if (!membership) {
        return res.status(403).json({ error: "Not in venue" });
      }
    }

    // participant filter
    let participantFilter: any = { conversationId };

    if (senderType === ParticipantType.USER) {
      participantFilter.userId = senderId;
    } else if (senderType === ParticipantType.BAND) {
      participantFilter.bandId = senderId;
    } else {
      participantFilter.venueId = senderId;
    }

    // check participation
    const existing = await prisma.conversationParticipant.findFirst({
      where: participantFilter
    });

    if (!existing) {
      return res.status(404).json({ error: "Not a participant in this conversation" });
    }

    // remove participant
    await prisma.conversationParticipant.deleteMany({
      where: participantFilter
    });

    // cleanup
    const remainingParticipants = await prisma.conversationParticipant.count({
      where: { conversationId }
    });

    // hard delete if no more participants
    if (remainingParticipants === 0) {
      await prisma.message.deleteMany({
        where: { conversationId: conversationId }
      })
      await prisma.conversation.delete({
        where: { id: conversationId }
      });

      return res.json({ message: "Conversation deleted (no participants left)" });
    }

    return res.json({ message: "Left conversation" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to leave conversation" });
  }
};
