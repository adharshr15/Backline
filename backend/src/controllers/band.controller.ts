import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'

export const getBands = async (req: Request, res: Response) => {
  try {
    const bands = await prisma.band.findMany()
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
    const { name, genre, location } = req.body

    const band = await prisma.band.create({
      data: { name, genre, location },
    })

    res.status(201).json(band)
  } catch (error: any) {
    console.error("Prisma createBand error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const updateBand = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { name, genre, location } = req.body

    const updatedBand = await prisma.band.update({
      where: { id },
      data: {
        name, 
        genre,
        location
      },
    })

    res.json(updatedBand)
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
    const id = req.params.id as string

    await prisma.band.delete({
      where: { id }
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