import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { VenueRole } from '../../generated/prisma/client'
import { Request, Response } from 'express';
import { InviteStatus } from '../../generated/prisma/client';
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

export const getMyShowInvites = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        // Find all bands the user is a member of
        const userVenues = await prisma.venueRepresentative.findMany({
            where: { userId },
            select: { venueId: true },
        });

        const venueIds = userVenues.map((b) => b.venueId);
        if (!venueIds.length) return res.json([]); // user in no bands

        // Fetch show invites for those bands
        const invites = await prisma.showInvite.findMany({
            where: { bandId: { in: venueIds }, status: InviteStatus.PENDING },
            include: {
                band: { select: { id: true, name: true } },
                show: { include: { venue: true, tour: true, bands: { include: { band: true } } } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json(invites);
    } catch (error: any) {
        console.error("Prisma getMyShowInvites error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

export const createVenue = async (req: AuthRequest, res: Response) => {
    try {
        const { name, city, state, country, latitude, longitude, capacity, contactEmail, representatives } = req.body;
        const creatorId = req.user?.userId

        if (!creatorId) return res.status(401).json({ error: "Unauthorized" });
        if (!name) return res.status(400).json({ error: "Venue name is required." });

        if (!city || !state || !country) return res.status(400).json({ error: "Location is required" })

        const accountType = "VENUE";

        const venue = await prisma.venue.create({
            data: {
                name, city, state, country, latitude, longitude, capacity, contactEmail, accountType,
                representatives: {
                    create: [
                        {
                            userId: creatorId,
                            role: "MANAGER"
                        }
                    ]
                }
            },
            include: {
                representatives: { include: { user: true } },
                shows: true
            }
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
            const isManager = requesterMembership?.role === "MANAGER" || requesterMembership?.role === "REPRESENTATIVE";

            // Force remove representative if requester is manager
            if (removeRepresentativeId) {
                if (!isManager) throw new Error("Only managers can remove representatives");

                await tx.venueRepresentative.delete({
                    where: { userId_venueId: { userId: removeRepresentativeId, venueId } }
                });
            }

            // invite new representative if provided
            if (inviteRepresentativeId) {
                if (!isManager)
                    throw new Error("Only managers can add representatives");

                // Check existing rep or invite
                const existingRep = await tx.venueRepresentative.findUnique({
                    where: { userId_venueId: { userId: inviteRepresentativeId, venueId } }
                });
                const existingInvite = await tx.venueInvite.findFirst({
                    where: {
                        venueId,
                        userId: inviteRepresentativeId,
                        status: "PENDING"
                    }
                });

                if (!existingRep && !existingInvite) {
                    console.log("Creating Venue Invite")
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
                include: { representatives: true, shows: true }
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

export const respondToShowInvite = async (req: AuthRequest, res: Response) => {
    try {
        const showInviteId = req.params.id as string;
        const { action } = req.body;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        // Fetch the invite and venue representatives
        const invite = await prisma.showInvite.findUnique({
            where: { id: showInviteId },
            include: { venue: { include: { representatives: true } } }
        });

        if (!invite) return res.status(404).json({ error: "Invite not found" });

        if (!invite.venueId) return res.status(400).json({ error: "This invite is not for a Venue" });

        const venueId = invite.venueId;

        // Check if current user is representative of venue
        const isVenueRep = invite.venue?.representatives.some((m) => m.userId === userId)
        if (!isVenueRep) return res.status(403).json({ error: "Not a venue representative" });

        if (action === "ACCEPT") {
            await prisma.$transaction(async (tx) => {
                // Update show to include venue
                await tx.show.update({
                    where: { id: invite.showId },
                    data: {
                        venueId: invite.venueId,
                        status: "CONFIRMED"
                    }
                });

                // Update invite status
                await tx.showInvite.update({
                    where: { id: showInviteId },
                    data: { status: InviteStatus.ACCEPTED }
                });
            })
        } else if (action === "DECLINE") {
            await prisma.showInvite.update({
                where: { id: showInviteId },
                data: { status: InviteStatus.DECLINED }
            });
        } else {
            return res.status(400).json({ error: "Invalid action, must be either ACCEPT or DECLINE" })
        }

        // Return updated show
        const updatedShow = await prisma.show.findUnique({
            where: { id: invite.showId },
            include: { bands: true },
        });

        res.status(200).json(updatedShow);
    } catch (error: any) {
        console.error("Prisma respondtoShowInvite error:", error.message);
        res.status(500).json({ error: error.message})
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