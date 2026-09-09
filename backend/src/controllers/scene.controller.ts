import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { canActAsLower } from "../lib/authorization";
import { resolveScene, stateSpellings } from "../lib/scenes";

/** Look up a scene by location without creating one. */
const findSceneByLocation = (city: string, state: string) =>
    prisma.scene.findFirst({
        where: {
            city: { equals: city, mode: "insensitive" },
            state: { in: stateSpellings(state), mode: "insensitive" },
        },
    });

export const followScene = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { city, state, country, followerId, followerType } = req.body as {
            city: string; state: string; country?: string;
            followerId: string; followerType: string;
        };

        if (!city || !state) {
            return res.status(400).json({ error: "city and state are required" });
        }

        if (!(await canActAsLower(userId, followerType, followerId))) {
            return res.status(403).json({ error: "You cannot follow scenes as this profile" });
        }

        // Follows are keyed on sceneId now. The request still speaks city/state --
        // the shipped app sends exactly that -- so resolve it here, creating the
        // scene if this is the first anyone has heard of that city.
        const scene = await resolveScene({ city, state, country });
        if (!scene) {
            return res.status(400).json({ error: "city and state are required" });
        }

        await prisma.sceneFollow.upsert({
            where: {
                followerId_followerType_sceneId: { followerId, followerType, sceneId: scene.id },
            },
            create: {
                sceneId: scene.id,
                followerId,
                followerType,
                city: scene.city,
                state: scene.state,
                country: scene.country,
            },
            update: {},
        });

        res.json({ success: true });
    } catch (error: any) {
        fail(res, error, "scene");
    }
};

export const unfollowScene = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { city, state, followerId, followerType } = req.body as {
            city: string; state: string; followerId: string; followerType: string;
        };

        if (!(await canActAsLower(userId, followerType, followerId))) {
            return res.status(403).json({ error: "You cannot unfollow scenes as this profile" });
        }

        // Resolve without creating: unfollowing a city nothing has ever heard of
        // should not bring that scene into existence.
        const scene = city && state ? await findSceneByLocation(city, state) : null;

        if (scene) {
            await prisma.sceneFollow.deleteMany({
                where: { followerId, followerType, sceneId: scene.id },
            });
        }

        res.json({ success: true });
    } catch (error: any) {
        fail(res, error, "scene");
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
        fail(res, error, "scene");
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
        fail(res, error, "scene");
    }
};
