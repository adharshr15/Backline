import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { fail } from '../middlewares/error.middleware';
import { VenueRole } from '../../generated/prisma/client'
import { Request, Response } from 'express';
import { InviteStatus } from '../../generated/prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import fs from 'fs';
import path from 'path';

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
        const search = req.query.search as string | undefined;
        const city   = req.query.city  as string | undefined;
        const state  = req.query.state as string | undefined;

        const where: any = { deletedAt: null };
        if (search) where.name  = { contains: search, mode: 'insensitive' };
        if (city)   where.city  = { equals:   city,   mode: 'insensitive' };
        if (state)  where.state = { equals:   state,  mode: 'insensitive' };

        const venues = await prisma.venue.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            where,
            select: {
                id: true,
                name: true,
                city: true,
                state: true,
                country: true,
                latitude: true,
                longitude: true,
                capacity: true,
                contactEmail: true,
                profileImageUrl: true,
                createdAt: true
            }
        });

        res.json(venues);
    } catch (error: any) {
        console.error("Prisma getVenues error:", error.message);
        fail(res, error, "venue");
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
        fail(res, error, "venue");
    }
};

export const getMyShowInvites = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const userVenues = await prisma.venueRepresentative.findMany({
            where: { userId },
            select: { venueId: true },
        });

        const venueIds = userVenues.map((b) => b.venueId);
        if (!venueIds.length) return res.json([]);

        const invites = await prisma.showInvite.findMany({
            where: { venueId: { in: venueIds }, status: InviteStatus.PENDING },
            select: {
                id: true,
                showId: true,
                bandId: true,
                venueId: true,
                status: true,
                createdAt: true,
                venue: { select: { id: true, name: true, profileImageUrl: true } },
                show: { select: { id: true, date: true, city: true, state: true, country: true, posterUrl: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json(invites);
    } catch (error: any) {
        console.error("Prisma getMyShowInvites error:", error.message);
        fail(res, error, "venue");
    }
};

export const createVenue = async (req: AuthRequest, res: Response) => {
    try {
        const { name, city, state, country, latitude, longitude, capacity, bio, contactEmail, representatives } = req.body;
        const creatorId = req.user?.userId


        const files = req.files as Record<string, Express.Multer.File[]>;

        const profileImageUrl = files?.profileImage?.[0]
            ? `/uploads/${files.profileImage[0].filename}`
            : undefined

        const headerImageUrl = files?.headerImage?.[0]
            ? `/uploads/${files.headerImage[0].filename}`
            : undefined

        if (!creatorId) return res.status(401).json({ error: "Unauthorized" });
        if (!name) return res.status(400).json({ error: "Venue name is required." });

        if (!city || !state || !country) return res.status(400).json({ error: "Location is required" })

        const accountType = "VENUE";

        const venue = await prisma.$transaction(async (tx) => {
            // 1. Create venue + creator as representative
            const createdVenue = await tx.venue.create({
                data: { name, city, state, country, latitude, longitude, capacity, bio, contactEmail, accountType, profileImageUrl, headerImageUrl, 
                    representatives: {
                        create: [
                            {
                                userId: creatorId,
                                role: "MANAGER"
                            },
                        ],
                    },
                },
                include: {
                    representatives: {
                        include: {
                            user: { select: { name: true, id: true } },
                        },
                    },
                    shows: true,
                },
            });

            // 2. Create invites
            if (representatives && Array.isArray(representatives)) {
                const invites = representatives
                    .filter((m: any) => m.userId !== creatorId)
                    .map((m: any) => ({
                        venueId: createdVenue.id,
                        userId: m.userId,
                        status: InviteStatus.PENDING,
                    }));

                if (invites.length > 0) {
                    await tx.venueInvite.createMany({
                        data: invites,
                    });
                }
            }

            return createdVenue;
        });

        res.status(201).json(venue);
    } catch (error: any) {
        console.error("Prisma createVenue error:", error.message);
        return fail(res, error, "venue");
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
            name, bio, city, state, country, address, latitude, longitude, capacity, contactEmail, inviteRepresentativeId, removeRepresentativeId, updateRole
        }: {
            name?: string;
            bio?: string;
            city?: string;
            state?: string;
            country?: string;
            address?: string;
            latitude?: number;
            longitude?: number;
            capacity?: number;
            contactEmail?: string;
            updateRole?: { userId: string; venueRole: VenueRole };
            inviteRepresentativeId?: string;
            removeRepresentativeId?: string;
        } = req.body;

        const files = req.files as Record<string, Express.Multer.File[]>;

        // Roster changes are manager-only. `userRep` is already loaded above.
        const isManager = userRep.role === "MANAGER";
        if ((removeRepresentativeId || inviteRepresentativeId || updateRole) && !isManager) {
            return res.status(403).json({ error: "Only managers can change the representative roster" });
        }

        const currentVenue = await prisma.venue.findUnique({ where: { id: venueId } });

        const updatedVenue = await prisma.$transaction(async (tx) => {
            const updateData: any = {};
            if (name) updateData.name = name;
            if (bio) updateData.bio = bio;
            if (city) updateData.city = city;
            if (state) updateData.state = state;
            if (country) updateData.country = country;
            if (address) updateData.address = address;
            if (latitude !== undefined) updateData.latitude = latitude;
            if (longitude !== undefined) updateData.longitude = longitude;
            if (capacity !== undefined) updateData.capacity = Number(capacity);
            if (contactEmail) updateData.contactEmail = contactEmail;

            if (files?.profileImage?.[0]) {
                if (currentVenue?.profileImageUrl) {
                    // Deletes old profile image
                    const oldPath = path.join(__dirname, "../../", currentVenue.profileImageUrl);
                    if (fs.existsSync(oldPath)) { fs.unlinkSync(oldPath); }
                }
                updateData.profileImageUrl = `/uploads/${files.profileImage[0].filename}`;
            }
            if (files?.headerImage?.[0]) {
                if (currentVenue?.headerImageUrl) {
                    // Deletes old header image
                    const oldPath = path.join(__dirname, "../../", currentVenue.headerImageUrl);
                    if (fs.existsSync(oldPath)) { fs.unlinkSync(oldPath); }
                }
                updateData.headerImageUrl = `/uploads/${files.headerImage[0].filename}`;
            }

            // Remove a representative (manager-only; checked before the transaction)
            if (removeRepresentativeId) {
                await tx.venueRepresentative.delete({
                    where: { userId_venueId: { userId: removeRepresentativeId, venueId } }
                });
            }

            // invite new representative if provided
            if (inviteRepresentativeId) {
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

            // Update member's role (manager-only; checked before the transaction)
            if (updateRole) {
                await tx.venueRepresentative.update({
                    where: { userId_venueId: { userId: updateRole.userId, venueId } },
                    data: { role: updateRole.venueRole }
                });
            }

            const venue = await tx.venue.update({
                where: { id: venueId },
                data: updateData,
                include: { representatives: { include: { user: { select: { name: true, id: true } } } }, shows: true }
            });

            return venue;
        });

        res.status(200).json(updatedVenue);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") return res.status(404).json({ error: "Venue not found" });
        fail(res, error, "venue");
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
        fail(res, error, "venue.respondToShowInvite")
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
        fail(res, error, "venue");
    }
};