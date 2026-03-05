import { Request, Response } from "express"
import { prisma } from "../lib/prisma"
import { userSafeSelect } from "../lib/prismaSelects";

// CREATE
export const createConversation = async (req: Request, res: Response) => {
  try {
    const { participantIds } = req.body;

    if (!participantIds || participantIds.length < 2) {
      return res.status(400).json({ error: "At least 2 participants required" });
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: participantIds.map((userId: string) => ({
            user: { connect: { id: userId } }
          }))
        }
      },
      include: {
        participants: {
          select: {
            user: { select: userSafeSelect }
          }
        }
      }
    });

    res.status(201).json(conversation);
  } catch (error: any) {
    console.error("createConversation error:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET
export const getConversationById = async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id as string

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          select: {
            user: { select: userSafeSelect }
          }
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: { select: userSafeSelect }
          }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    res.json(conversation)
  } catch (error: any) {
    console.error("getConversationById error:", error.message)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const getUserConversations = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId } }
      },
      include: {
        participants: {
          select: {
            user: { select: userSafeSelect }
          }
        }
      }
    });

    res.status(200).json(conversations);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE
export const updateConversation = async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id as string
    const { name, addParticipantId, removeParticipantId } = req.body

    const conversation = await prisma.$transaction(async (tx) => {
      if (addParticipantId) {
        await tx.conversationParticipant.create({
          data: {
            userId: addParticipantId,
            conversationId
          }
        })
      }

      if (removeParticipantId) {
        await tx.conversationParticipant.deleteMany({
          where: {
            userId: removeParticipantId,
            conversationId
          }
        })
      }

      return tx.conversation.update({
        where: { id: conversationId },
        data: name ? { name } : {},
        include: {
          participants: {
            select: { user: { select: userSafeSelect } }
          }
        }
      })
    })

    res.json(conversation)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

// DELETE
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id as string

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        deletedAt: new Date(),
      },
    })

    res.json({
      message: "Conversation soft deleted successfully",
      conversation,
    })
  } catch (error: any) {
    console.error("deleteConversation error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Conversation not found" })
    }

    res.status(500).json({ error: "Internal server error" })
  }
}