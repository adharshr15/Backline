import { Request, Response } from "express"
import { prisma } from "../lib/prisma"
import { userSafeSelect } from "../lib/prismaSelects"

export const createMessage = async (req: Request, res: Response) => {
  try {
    const { content, senderId, conversationId } = req.body

    if (!content || !senderId || !conversationId) {
      return res.status(400).json({
        error: "content, senderId, and conversationId are required",
      })
    }

    const message = await prisma.message.create({
      data: {
        content,
        sender: { connect: { id: senderId } },
        conversation: { connect: { id: conversationId } },
      },
      include: {
        sender: { select: userSafeSelect },
      },
    });

    res.status(201).json(message)
  } catch (error: any) {
    console.error("createMessage error:", error.message)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const getMessagesForConversation = async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: userSafeSelect },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(messages)
  } catch (error: any) {
    console.error("getMessagesForConversation error:", error.message)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const messageId = req.params.id as string;

    const message = await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: { sender: { select: userSafeSelect } },
    });

    res.json({ message: "Message soft deleted successfully" })
  } catch (error: any) {
    console.error("deleteMessage error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Message not found" })
    }

    res.status(500).json({ error: "Internal server error" })
  }
}