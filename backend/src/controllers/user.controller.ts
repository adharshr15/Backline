import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        bandMemberships: { include: { band: true } },
        venueReps: { include: { venue: true } },
        conversations: false
      }
    })
    res.json(users)
  } catch (error: any) {
    console.error("Prisma getUsers error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        bandMemberships: { include: { band: true } },
        venueReps: { include: { venue: true } },
        conversations: false
      }
    })

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(user)
  } catch (error: any) {
    console.error("Prisma getUserById error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, username, name, role, bandId, bandRole, venueId } = req.body

    const user = await prisma.user.create({
      data: {
        email, password, username, name, role,
        bandMemberships: bandId ? {
          create: {
            band: { connect: { id: bandId } },
            role: bandRole || undefined
          }
        }
          : undefined,
        venueReps: venueId ? {
          create: {
            venue: { connect: { id: venueId } }
          }
        }
          : undefined
      },
      include: {
        bandMemberships: { include: { band: true } },
        venueReps: { include: { venue: true } },
        conversations: false
      }
    })

    res.status(201).json(user)
  } catch (error: any) {
    console.error("Prisma createUser error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { email, password, username, name, role, bandId, bandRole, venueId, removeBandId, removeVenueId, addConversationId, removeConversationId } = req.body

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        email,
        password,
        username,
        name,
        role,
        // Add/Update bands
        bandMemberships: bandId
          ? {
            upsert: {
              where: { userId_bandId: { userId: id, bandId } },
              create: { band: { connect: { id: bandId } }, role: bandRole || undefined },
              update: { role: bandRole || undefined }
            }
          }
          : undefined,
        // Remove bands 
        ...(removeBandId ? {
          delete: { userId_bandId: { userId: id, bandId: removeBandId } }
        } : {}),
        // Add/Update venues
        venueReps: venueId
          ? {
            create: { venue: { connect: { id: venueId } } }
          }
          : undefined,
        // Remove venues
        ...(removeVenueId ? {
          delete: { userId_venueId: { userId: id, venueId: removeVenueId } }
        } : {}),
        // Add/Update conversations
        conversations: addConversationId ? {
          create: { conversationId: addConversationId }
        } : undefined,
        // Remove conversations
        ...(removeConversationId ? {
          delete: { userId_conversationId: { userId: id, conversationId: removeConversationId } }
        } : {})
      },
      include: {
        bandMemberships: { include: { band: true } },
        venueReps: { include: { venue: true } },
        conversations: false
      }
    })

    res.json(updatedUser)
  } catch (error: any) {
    console.error("Prisma updateUser error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" })
    }

    res.status(500).json({ error: error.message })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    await prisma.bandMember.deleteMany({ where: { userId: id } })
    await prisma.venueRepresentative.deleteMany({ where: { userId: id } })
    await prisma.conversationParticipant.deleteMany({ where: { userId: id } })

    await prisma.user.delete({
      where: { id }
    })

    res.json({ message: "User deleted successfully" })
  } catch (error: any) {
    console.error("Prisma deleteUser error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" })
    }

    res.status(500).json({ error: error.message })
  }
}