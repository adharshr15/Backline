import { Response } from "express"
import { prisma } from "../lib/prisma"
import { AuthRequest } from "../middlewares/auth.middleware"


// GET
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const userId = req.user?.userId as string

    if (!userId) return res.status(401).json({ error: "Unauthorized"})

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: id,
        userId
      }
    })

    if (!participant) return res.status(403).json({ error: "Not a participant" })

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id
      },
      orderBy: {
        createdAt: "asc"
      }
    })

    res.json(messages)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to get messages" })
  }
}


// SEND
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const userId = req.user?.userId as string

    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const { content } = req.body

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: id,
        userId
      }
    })

    if (!participant) return res.status(403).json({ error: "Not a participant" })
    
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderUserId: userId,
        content
      }
    })

    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() }
    })

    res.status(201).json(message)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to send message", content: req.body.content })
  }
}
