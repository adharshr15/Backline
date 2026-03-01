import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'

export const getVenues = async (req: Request, res: Response) => {
    try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const venues = await prisma.venue.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        city: true,
        state: true,
        country: true,
        latitude: true,
        longitude: true,
        capacity: true,
        contactEmail: true,
        createdAt: true
      }
    });

    res.json(venues)
  } catch (error: any) {
    console.error("Prisma getVenues error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const getVenueById = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string

        const venue = await prisma.venue.findUnique({
            where: { id },
            include: {
                representatives: { include: { user: true } }
            }
        })

        if (!venue) {
            return res.status(404).json({ error: "Venue not found" })
        }

        res.json(venue)
    } catch (error: any) {
        console.error("Prisma getVenueById error: ", error.message)
        res.status(500).json({ error: error.message })
    }
}

export const createVenue = async (req: Request, res: Response) => {
    try {
        const {
            name,
            city,
            state,
            country,
            latitude,
            longitude,
            capacity,
            contactEmail,
            representatives
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Venue name is required." });
        }

        if (!representatives || !Array.isArray(representatives) || representatives.length === 0) {
            return res.status(400).json({
                error: "Venue must be created with at least one representative."
            });
        }

        const venue = await prisma.venue.create({
            data: {
                name,
                city,
                state,
                country,
                latitude,
                longitude,
                capacity,
                contactEmail,
                representatives: {
                    create: representatives.map((rep: any) => ({
                        user: {
                            connect: { id: rep.userId }
                        }
                    }))
                }
            },
            include: {
                representatives: true
            }
        });

        return res.status(201).json(venue);

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};