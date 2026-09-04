import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { fail } from '../middlewares/error.middleware';
import { AccountType } from '../../generated/prisma/client';
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { canActAs } from '../lib/authorization';
import { ParticipantType } from '../../generated/prisma/enums';

const buildFollowerWhere = (followerType: AccountType, followerBandId?: string, followerVenueId?: string, userId?: string) => {
    if (followerType === 'USER') return { followerType, followerUserId: userId };
    if (followerType === 'BAND') return { followerType, followerBandId };
    if (followerType === 'VENUE') return { followerType, followerVenueId };
    return null;
};

const buildFolloweeWhere = (followeeType: AccountType, followeeId: string) => {
    if (followeeType === 'USER') return { followeeType, followeeUserId: followeeId };
    if (followeeType === 'BAND') return { followeeType, followeeBandId: followeeId };
    if (followeeType === 'VENUE') return { followeeType, followeeVenueId: followeeId };
    return null;
};

export const follow = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { followerType, followerBandId, followerVenueId, followeeType, followeeId } = req.body;

        if (followerType === 'BAND') {
            const member = await prisma.bandMember.findUnique({
                where: { userId_bandId: { userId, bandId: followerBandId } }
            });
            if (!member) return res.status(403).json({ error: 'Not a member of this band' });
        }

        if (followerType === 'VENUE') {
            const rep = await prisma.venueRepresentative.findUnique({
                where: { userId_venueId: { userId, venueId: followerVenueId } }
            });
            if (!rep) return res.status(403).json({ error: 'Not a representative of this venue' });
        }

        const followerWhere = buildFollowerWhere(followerType, followerBandId, followerVenueId, userId);
        const followeeWhere = buildFolloweeWhere(followeeType, followeeId);
        if (!followerWhere || !followeeWhere) return res.status(400).json({ error: 'Invalid account type' });

        const existing = await prisma.follow.findFirst({ where: { ...followerWhere, ...followeeWhere } });
        if (existing) return res.status(409).json({ error: 'Already following' });

        const follow = await prisma.follow.create({
            data: {
                followerType,
                followerUserId: followerType === 'USER' ? userId : undefined,
                followerBandId: followerType === 'BAND' ? followerBandId : undefined,
                followerVenueId: followerType === 'VENUE' ? followerVenueId : undefined,
                followeeType,
                followeeUserId: followeeType === 'USER' ? followeeId : undefined,
                followeeBandId: followeeType === 'BAND' ? followeeId : undefined,
                followeeVenueId: followeeType === 'VENUE' ? followeeId : undefined,
            }
        });

        res.status(201).json(follow);
    } catch (error: any) {
        console.error('follow error:', error.message);
        fail(res, error, "follow");
    }
};

export const unfollow = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { followerType, followerBandId, followerVenueId, followeeType, followeeId } = req.body;

        // Mirror the membership checks in `follow` — without them anyone could make
        // any band or venue unfollow anyone.
        if (followerType === 'BAND' && !(await canActAs(userId, ParticipantType.BAND, followerBandId))) {
            return res.status(403).json({ error: 'Not a member of this band' });
        }
        if (followerType === 'VENUE' && !(await canActAs(userId, ParticipantType.VENUE, followerVenueId))) {
            return res.status(403).json({ error: 'Not a representative of this venue' });
        }

        const followerWhere = buildFollowerWhere(followerType, followerBandId, followerVenueId, userId);
        const followeeWhere = buildFolloweeWhere(followeeType, followeeId);
        if (!followerWhere || !followeeWhere) return res.status(400).json({ error: 'Invalid account type' });

        const existing = await prisma.follow.findFirst({ where: { ...followerWhere, ...followeeWhere } });
        if (!existing) return res.status(404).json({ error: 'Not following' });

        await prisma.follow.delete({ where: { id: existing.id } });

        res.status(200).json({ message: 'Unfollowed successfully' });
    } catch (error: any) {
        console.error('unfollow error:', error.message);
        fail(res, error, "follow");
    }
};

export const checkFollowing = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { followerType, followerBandId, followerVenueId, followeeType, followeeId } = req.query as Record<string, string>;

        const followerWhere = buildFollowerWhere(followerType as AccountType, followerBandId, followerVenueId, userId);
        const followeeWhere = buildFolloweeWhere(followeeType as AccountType, followeeId);
        if (!followerWhere || !followeeWhere) return res.status(400).json({ error: 'Invalid account type' });

        const existing = await prisma.follow.findFirst({ where: { ...followerWhere, ...followeeWhere } });

        res.json({ isFollowing: !!existing });
    } catch (error: any) {
        console.error('checkFollowing error:', error.message);
        fail(res, error, "follow");
    }
};

export const getFollowers = async (req: AuthRequest, res: Response) => {
    try {
        const { type, id } = req.params;

        const accountId = id as string;
        const whereField =
            type === 'user' ? { followeeUserId: accountId } :
            type === 'band' ? { followeeBandId: accountId } :
            { followeeVenueId: accountId };

        const follows = await prisma.follow.findMany({
            where: whereField,
            include: {
                followerUser: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
                followerBand: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
                followerVenue: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
            }
        });

        const result = follows.map(f => f.followerUser ?? f.followerBand ?? f.followerVenue).filter(Boolean);
        res.json(result);
    } catch (error: any) {
        console.error('getFollowers error:', error.message);
        fail(res, error, "follow");
    }
};

export const getFollowing = async (req: AuthRequest, res: Response) => {
    try {
        const { type, id } = req.params;

        const accountId = id as string;
        const whereField =
            type === 'user' ? { followerUserId: accountId } :
            type === 'band' ? { followerBandId: accountId } :
            { followerVenueId: accountId };

        const follows = await prisma.follow.findMany({
            where: whereField,
            include: {
                followeeUser: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
                followeeBand: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
                followeeVenue: { select: { id: true, name: true, profileImageUrl: true, accountType: true } },
            }
        });

        const result = follows.map(f => f.followeeUser ?? f.followeeBand ?? f.followeeVenue).filter(Boolean);
        res.json(result);
    } catch (error: any) {
        console.error('getFollowing error:', error.message);
        fail(res, error, "follow");
    }
};
