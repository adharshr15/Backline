import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { fail } from '../middlewares/error.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Response } from 'express';

export const search = async (req: AuthRequest, res: Response) => {
    try {
        const q = (req.query.q as string)?.trim();
        if (!q || q.length < 1) return res.json([]);

        const contains = { contains: q, mode: 'insensitive' as const };

        const [users, bands, venues] = await Promise.all([
            prisma.user.findMany({
                where: {
                    deletedAt: null,
                    OR: [{ name: contains }, { username: contains }],
                },
                select: { id: true, name: true, username: true, profileImageUrl: true, accountType: true },
                take: 10,
            }),
            prisma.band.findMany({
                where: { deletedAt: null, name: contains },
                select: { id: true, name: true, genre: true, profileImageUrl: true, accountType: true },
                take: 10,
            }),
            prisma.venue.findMany({
                where: { deletedAt: null, name: contains },
                select: { id: true, name: true, city: true, state: true, profileImageUrl: true, accountType: true },
                take: 10,
            }),
        ]);

        const results = [
            ...users.map(u => ({
                id: u.id,
                name: u.name,
                subtitle: `@${u.username}`,
                profileImageUrl: u.profileImageUrl,
                accountType: u.accountType,
            })),
            ...bands.map(b => ({
                id: b.id,
                name: b.name,
                subtitle: b.genre ?? 'Band',
                profileImageUrl: b.profileImageUrl,
                accountType: b.accountType,
            })),
            ...venues.map(v => ({
                id: v.id,
                name: v.name,
                subtitle: v.city && v.state ? `${v.city}, ${v.state}` : 'Venue',
                profileImageUrl: v.profileImageUrl,
                accountType: v.accountType,
            })),
        ];

        res.json(results);
    } catch (error: any) {
        console.error('search error:', error.message);
        fail(res, error, "search");
    }
};
