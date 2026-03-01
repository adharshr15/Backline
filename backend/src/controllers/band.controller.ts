import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { BandRole } from '../../generated/prisma/client'
import { Request, Response } from 'express'

export const getBands = async (req: Request, res: Response) => {
  try {
    const bands = await prisma.band.findMany({
      include: {
        members: { include: { user: true } },
        tours: false
      }
    })
    res.json(bands)
  } catch (error: any) {
    console.error("Prisma getBands error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const getBandById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const band = await prisma.band.findUnique({
      where: { id },
      include: {
        members: { include: { user: true } },
        tours: false
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

export const createBand = async (req: Request, res: Response) => {
  try {
    const { name, genre, location, members, tours } = req.body
    
    /* 
     * Members is an array of UserIds and Roles
     * members_example = [{"userId": "userid1", "role": "MEMBER"}, {"userId": "userid2", "role": "MANAGER"}] 
     */

    if (!name) { res.status(400).json({ error: "Band name is required." }) }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        error: "Band must be created with at least one member."
      })
    }

    const band = await prisma.band.create({
      data: {
        name, genre, location,
        members: members ? { create: members } : undefined,
        tours: tours ? { create: tours } : undefined
      },
      include: {
        members: true,
        tours: true
      },
    })

    res.status(201).json(band)
  } catch (error: any) {
    console.error("Prisma createBand error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const updateBand = async (req: Request, res: Response) => {
  try {
    const bandId = req.params.id as string

    const { name, genre, location, addMembers, removeMemberIds, updateRoles, addTours, updateTours, removeTourIds }: 
    {
      name?: string
      genre?: string
      location?: string
      addMembers?: { userId: string; role?: BandRole }[]
      removeMemberIds?: string[]
      updateRoles?: { userId: string; role: BandRole }[]
      addTours?: { name: string }[]
      updateTours?: { id: string; name?: string }[]
      removeTourIds?: string[]
    } = req.body

    const result = await prisma.$transaction(async (tx) => {
      await tx.band.update({
        where: { id: bandId },
        data: {
          name, genre, location,
          members: {
            create: addMembers || undefined,

            deleteMany: removeMemberIds
              ? removeMemberIds.map((userId) => ({ userId }))
              : undefined,

            update: updateRoles
              ? updateRoles.map(({ userId, role }) => ({
                  where: {
                    userId_bandId: {
                      userId,
                      bandId,
                    },
                  },
                  data: { role },
                }))
              : undefined,
          },
          tours: {
            create: addTours || undefined,

            deleteMany: removeTourIds
              ? removeTourIds.map((id) => ({ id }))
              : undefined,

            update: updateTours
              ? updateTours.map(({ id, name }) => ({
                  where: { id },
                  data: { name },
                }))
              : undefined,
          },
        },
      })

      // Count remaining members
      const memberCount = await tx.bandMember.count({
        where: { bandId }
      })

      // If no members, delete band
      if (memberCount === 0) {
        await tx.band.delete({
          where: { id: bandId }
        })

        return { deleted: true }
      }

      // Otherwise return updated band
      return tx.band.findUnique({
        where: { id: bandId },
        include: {
          members: { include: { user: true } },
          tours: true,
        },
      })
    })

    if ((result as any)?.deleted) {
      return res.json({
        message: "Last member removed. Band deleted."
      })
    }

    res.json(result)

  } catch (error: any) {
    console.error("Prisma updateBand error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Band not found" })
    }

    res.status(500).json({ error: error.message })
  }
}

export const deleteBand = async (req: Request, res: Response) => {
  try {
    const bandId = req.params.id as string

    await prisma.$transaction(async (tx) => {

      // Delete band members first
      await tx.bandMember.deleteMany({
        where: { bandId }
      })

      // Delete tours belonging to this band
      await tx.tour.deleteMany({
        where: { bandId }
      })

      // Now delete the band
      await tx.band.delete({
        where: { id: bandId }
      })
    })

    res.json({ message: "Band deleted successfully" })

  } catch (error: any) {
    console.error("Prisma deleteBand error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Band not found" })
    }

    res.status(500).json({ error: error.message })
  }
}