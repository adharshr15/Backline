import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { fail } from '../middlewares/error.middleware';
import { Request, Response } from 'express';

type ProfileKind = 'user' | 'band' | 'venue';

// Maps a lowercase profile kind -> the column used on each polymorphic model.
const followeeCol = (t: ProfileKind) =>
    t === 'user' ? 'followeeUserId' : t === 'band' ? 'followeeBandId' : 'followeeVenueId';
const followerCol = (t: ProfileKind) =>
    t === 'user' ? 'followerUserId' : t === 'band' ? 'followerBandId' : 'followerVenueId';
const ownerCol = (t: ProfileKind) =>
    t === 'user' ? 'ownerUserId' : t === 'band' ? 'ownerBandId' : 'ownerVenueId';
const listingCol = (t: ProfileKind) =>
    t === 'user' ? 'createdByUserId' : t === 'band' ? 'createdByBandId' : 'createdByVenueId';

// Shows this profile truly OWNS (hosts) — excludes reposts. Mirrors the
// ownership OR in getShows (show.controller.ts) minus the repost legs.
const hostedShowsWhere = (t: ProfileKind, id: string) => {
    if (t === 'band')  return { deletedAt: null, OR: [{ createdByBandId: id }, { bands: { some: { bandId: id } } }] };
    if (t === 'venue') return { deletedAt: null, OR: [{ venueId: id }, { createdByVenueId: id }] };
    return { deletedAt: null, createdByUserId: id };
};

// Shows this profile RSVP'd to (attending). Mirrors getRsvpShows.
const attendingShowsWhere = (t: ProfileKind, id: string) => {
    if (t === 'band')  return { deletedAt: null, rsvpBands:  { some: { id } } };
    if (t === 'venue') return { deletedAt: null, rsvpVenues: { some: { id } } };
    return { deletedAt: null, rsvpUsers: { some: { id } } };
};

export const getProfileMetrics = async (req: Request, res: Response) => {
    try {
        const type = req.params.type as ProfileKind;
        const id = req.params.id as string;
        if (!['user', 'band', 'venue'].includes(type)) {
            return res.status(400).json({ error: 'Invalid profile type' });
        }

        const hostedShows = await prisma.show.findMany({
            where: hostedShowsWhere(type, id) as any,
            select: {
                id: true,
                date: true,
                city: true,
                venueName: true,
                venue: { select: { name: true } },
                _count: {
                    select: {
                        rsvpUsers: true,
                        rsvpBands: true,
                        rsvpVenues: true,
                        repostedByUsers: true,
                        repostedByBands: true,
                        repostedByVenues: true,
                    },
                },
            },
        });

        let totalRsvps = 0;
        let totalReposts = 0;
        let topShow: { id: string; label: string; date: Date; rsvpCount: number } | null = null;

        for (const s of hostedShows) {
            const rsvps = s._count.rsvpUsers + s._count.rsvpBands + s._count.rsvpVenues;
            const reposts = s._count.repostedByUsers + s._count.repostedByBands + s._count.repostedByVenues;
            totalRsvps += rsvps;
            totalReposts += reposts;
            if (rsvps > 0 && (!topShow || rsvps > topShow.rsvpCount)) {
                topShow = {
                    id: s.id,
                    label: s.venue?.name ?? s.venueName ?? s.city,
                    date: s.date,
                    rsvpCount: rsvps,
                };
            }
        }

        const [
            followers,
            following,
            showsAttending,
            posts,
            likesReceived,
            listings,
            scenesFollowed,
        ] = await Promise.all([
            prisma.follow.count({ where: { [followeeCol(type)]: id } as any }),
            prisma.follow.count({ where: { [followerCol(type)]: id } as any }),
            prisma.show.count({ where: attendingShowsWhere(type, id) as any }),
            prisma.post.count({ where: { [ownerCol(type)]: id, deletedAt: null } as any }),
            prisma.postLike.count({ where: { post: { [ownerCol(type)]: id, deletedAt: null } } as any }),
            prisma.listing.count({ where: { [listingCol(type)]: id, deletedAt: null } as any }),
            prisma.sceneFollow.count({ where: { followerId: id, followerType: type } }),
        ]);

        res.json({
            followers,
            following,
            showsHosted: hostedShows.length,
            totalRsvps,
            totalReposts,
            showsAttending,
            posts,
            likesReceived,
            listings,
            scenesFollowed,
            topShow,
        });
    } catch (error: any) {
        console.error('getProfileMetrics error:', error.message);
        fail(res, error, "metrics");
    }
};
