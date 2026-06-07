import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

export const followScene = async (req: AuthRequest, res: Response) => {
    try {
        const { city, state, country, followerId, followerType } = req.body as {
            city: string; state: string; country?: string;
            followerId: string; followerType: string;
        };

        await prisma.sceneFollow.upsert({
            where: { followerId_followerType_city_state: { followerId, followerType, city, state } },
            create: { city, state, country: country ?? null, followerId, followerType },
            update: {},
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const unfollowScene = async (req: AuthRequest, res: Response) => {
    try {
        const { city, state, followerId, followerType } = req.body as {
            city: string; state: string; followerId: string; followerType: string;
        };

        await prisma.sceneFollow.deleteMany({
            where: { followerId, followerType, city, state },
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getFollowedScenes = async (req: Request, res: Response) => {
    try {
        const { followerId, followerType } = req.query as Record<string, string>;
        if (!followerId || !followerType) {
            return res.status(400).json({ error: "followerId and followerType required" });
        }

        const scenes = await prisma.sceneFollow.findMany({
            where: { followerId, followerType },
            orderBy: { createdAt: "asc" },
        });

        res.json(scenes);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getSceneCities = async (req: Request, res: Response) => {
    try {
        const result = await prisma.venue.groupBy({
            by: ["city", "state"],
            where: {
                deletedAt: null,
                latitude: { not: null },
                longitude: { not: null },
            },
            _avg: { latitude: true, longitude: true },
            _count: { id: true },
        });

        const cities = result
            .filter(r => r._avg.latitude != null && r._avg.longitude != null)
            .map(r => ({
                city: r.city,
                state: r.state,
                lat: r._avg.latitude!,
                lng: r._avg.longitude!,
                venueCount: r._count.id,
            }));

        res.json(cities);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
