import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { VenueRole } from '../../generated/prisma/client'
import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';

const authorizeVenueRep = async (venueId: string, userId: string) => {
    const rep = await prisma.venueRepresentative.findUnique({
        where: { userId_venueId: { userId, venueId } }
    });
    return rep;
};

export const getVenues = async (req: AuthRequest, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const venues = await prisma.venue.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            where: { deletedAt: null },
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

        res.json(venues);
    } catch (error: any) {
        console.error("Prisma getVenues error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

export const getVenueById = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id as string;

        const venue = await prisma.venue.findUnique({
            where: { id },
            include: {
                representatives: { include: { user: true } }
            }
        });

        if (!venue || venue.deletedAt) {
            return res.status(404).json({ error: "Venue not found" });
        }

        res.json(venue);
    } catch (error: any) {
        console.error("Prisma getVenueById error: ", error.message);
        res.status(500).json({ error: error.message });
    }
};

export const createVenue = async (req: AuthRequest, res: Response) => {
    try {
        const { name, city, state, country, latitude, longitude, capacity, contactEmail, representatives } = req.body;
        const creatorId = req.user?.userId

        if (!creatorId) return res.status(401).json({ error: "Unauthorized" });
        if (!name) return res.status(400).json({ error: "Venue name is required." });

        const venue = await prisma.venue.create({
            data: {
                name, city, state, country, latitude, longitude, capacity, contactEmail,
                representatives: {
                    create: [
                        {
                            userId: creatorId,
                            role: "MANAGER"
                        }
                    ]
                }
            },
            include: { representatives: { include: { user: true } } }
        });

        // Send invites to any other users passed in `members`
        if (representatives && Array.isArray(representatives)) {
            for (const m of representatives) {
                if (m.userId !== creatorId) {
                    await prisma.venueInvite.create({
                        data: {
                            venueId: venue.id,
                            userId: m.userId,
                            status: 'PENDING'
                        }
                    });
                }
            }
        }

        res.status(201).json(venue);
    } catch (error: any) {
        console.error("Prisma createVenue error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};

export const updateVenue = async (req: AuthRequest, res: Response) => {
    try {
        const venueId = req.params.id as string;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const userRep = await authorizeVenueRep(venueId, userId);
        if (!userRep) return res.status(403).json({ error: "Forbidden: not a representative" });

        const {
            name, city, state, country, latitude, longitude, capacity, contactEmail, inviteRepresentativeId, removeRepresentativeId, updateRole
        }: {
            name?: string;
            city?: string;
            state?: string;
            country?: string;
            latitude?: number;
            longitude?: number;
            capacity?: number;
            contactEmail?: string;
            updateRole?: { userId: string; venueRole: VenueRole };
            inviteRepresentativeId?: string;
            removeRepresentativeId?: string;
        } = req.body;

        const updatedVenue = await prisma.$transaction(async (tx) => {
            const updateData: any = {};
            if (name) updateData.name = name;
            if (city) updateData.city = city;
            if (state) updateData.state = state;
            if (country) updateData.country = country;
            if (latitude !== undefined) updateData.latitude = latitude;
            if (longitude !== undefined) updateData.longitude = longitude;
            if (capacity !== undefined) updateData.capacity = capacity;
            if (contactEmail) updateData.contactEmail = contactEmail;

            // Check if requester is a manager
            const requesterMembership = await tx.venueRepresentative.findUnique({
                where: { userId_venueId: { userId, venueId } }
            });
            const isManager = requesterMembership?.role === "MANAGER";

            // Force remove representative if requester is manager
            if (removeRepresentativeId) {
                if (!isManager) throw new Error("Only managers can remove representatives");

                await tx.venueRepresentative.delete({
                    where: { userId_venueId: { userId: removeRepresentativeId, venueId } }
                });
            }

            // invite new representative if requester is manager
            if (inviteRepresentativeId) {
                if (!isManager)
                    throw new Error("Only managers can add representatives");

                // Check existing rep or invite
                const existingRep = await tx.venueRepresentative.findUnique({
                    where: { userId_venueId: { userId: inviteRepresentativeId, venueId } }
                });
                const existingInvite = await tx.venueInvite.findUnique({
                    where: { venueId_userId: { venueId, userId: inviteRepresentativeId } }
                });

                if (!existingRep && !existingInvite) {
                    await tx.venueInvite.create({ data: { venueId, userId: inviteRepresentativeId } });
                }
            }

            // Update member's role 
            if (updateRole) {
                if (!isManager)
                    throw new Error("Only managers can update roles");

                await tx.venueRepresentative.update({
                    where: { userId_venueId: { userId: updateRole.userId, venueId } },
                    data: { role: updateRole.venueRole }
                });
            }

            const venue = await tx.venue.update({
                where: { id: venueId },
                data: updateData,
                include: { representatives: true }
            });

            return venue;
        });

        res.status(200).json(updatedVenue);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") return res.status(404).json({ error: "Venue not found" });
        res.status(500).json({ error: error.message });
    }
};

export const respondToInvite = async (req: AuthRequest, res: Response) => {
  try {
    const venueId = req.params.id as string;
    const userId = req.user?.userId;
    const { action } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const invite = await prisma.venueInvite.findUnique({
      where: { venueId_userId: { venueId, userId } }
    });

    if (!invite) return res.status(404).json({ error: "Invite not found" });

    if (action === "ACCEPT") {
      // Check if user is already a representative
      const existingRep = await prisma.venueRepresentative.findUnique({
        where: { userId_venueId: { userId, venueId } }
      });
      if (!existingRep) {
        await prisma.venueRepresentative.create({
          data: { venueId, userId, role: "REPRESENTATIVE" }
        });
      }
    }

    // Delete the invite regardless of action
    await prisma.venueInvite.delete({ where: { id: invite.id } });

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: { representatives: true }
    });

    res.status(200).json(venue);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteVenue = async (req: AuthRequest, res: Response) => {
    try {
        const venueId = req.params.id as string;
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const userRep = await authorizeVenueRep(venueId, userId);
        if (!userRep || userRep.role !== "MANAGER") return res.status(403).json({ error: "Forbidden: only managers can delete a venue" });

        await prisma.$transaction(async (tx) => {
            await tx.venueRepresentative.deleteMany({ where: { venueId } });
            await tx.venue.update({ where: { id: venueId }, data: { deletedAt: new Date() } });
        });

        res.json({ message: "Venue soft-deleted successfully" });
    } catch (error: any) {
        console.error("Prisma deleteVenue error: ", error.message);
        if (error.code === "P2025") return res.status(404).json({ error: "Venue not found" });
        res.status(500).json({ error: error.message });
    }
};