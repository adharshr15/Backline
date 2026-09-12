import { Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { canActAs, isValidParticipantType } from "../lib/authorization";
import { userCraftsSelect } from "../lib/prismaSelects";
import { Craft, ParticipantType } from "../../generated/prisma/enums";

const parseCraft = (raw: unknown): Craft | null => {
  const craft = typeof raw === "string" ? raw.toUpperCase() : "";
  return (Object.values(Craft) as string[]).includes(craft) ? (craft as Craft) : null;
};

const countFor = (targetUserId: string, craft: Craft) =>
  prisma.craftRecommendation.count({ where: { targetUserId, craft } });

// POST /users/:id/crafts/:craft/recommend — recommend as a profile (idempotent).
export const recommendCraft = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const targetUserId = req.params.id as string;
    const craft = parseCraft(req.params.craft);
    if (!craft) return res.status(400).json({ error: "Invalid craft" });

    const { recommenderType, recommenderId } = (req.body ?? {}) as { recommenderType?: string; recommenderId?: unknown };
    if (!isValidParticipantType(recommenderType) || typeof recommenderId !== "string" || !recommenderId) {
      return res.status(400).json({ error: "recommenderType and recommenderId are required" });
    }
    if (recommenderType === ParticipantType.USER && recommenderId === targetUserId) {
      return res.status(400).json({ error: "You cannot recommend yourself" });
    }
    if (!(await canActAs(userId, recommenderType, recommenderId))) {
      return res.status(403).json({ error: "You cannot recommend as this profile" });
    }

    const listed = await prisma.userCraft.findFirst({
      where: { userId: targetUserId, craft, user: { deletedAt: null } },
      select: { id: true },
    });
    if (!listed) return res.status(404).json({ error: "User does not list this craft" });

    const key = { targetUserId, craft, recommenderType, recommenderId };
    await prisma.craftRecommendation.upsert({
      where: { targetUserId_craft_recommenderType_recommenderId: key },
      create: key,
      update: {},
    });

    res.status(201).json({ recommended: true, count: await countFor(targetUserId, craft) });
  } catch (error: any) {
    fail(res, error, "recommendations");
  }
};

// DELETE /users/:id/crafts/:craft/recommend?recommenderType&recommenderId — remove a recommendation.
export const unrecommendCraft = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const targetUserId = req.params.id as string;
    const craft = parseCraft(req.params.craft);
    if (!craft) return res.status(400).json({ error: "Invalid craft" });

    const { recommenderType, recommenderId } = { ...req.body, ...req.query } as { recommenderType?: string; recommenderId?: unknown };
    if (!isValidParticipantType(recommenderType) || typeof recommenderId !== "string" || !recommenderId) {
      return res.status(400).json({ error: "recommenderType and recommenderId are required" });
    }
    if (!(await canActAs(userId, recommenderType, recommenderId))) {
      return res.status(403).json({ error: "You cannot remove a recommendation for this profile" });
    }

    await prisma.craftRecommendation.deleteMany({ where: { targetUserId, craft, recommenderType, recommenderId } });
    res.json({ recommended: false, count: await countFor(targetUserId, craft) });
  } catch (error: any) {
    fail(res, error, "recommendations");
  }
};

/**
 * GET /users/:id/recommendations?viewerType&viewerId
 *
 * One entry per craft the user currently lists, in craft order. Recommendations for
 * a removed craft stay stored but are not returned. `recommendedByViewer` is only
 * computed for a viewer the caller may act as, so it cannot be used to probe who
 * recommended someone.
 */
export const getCraftRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const targetUserId = req.params.id as string;

    const user = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: { crafts: userCraftsSelect },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const crafts = user.crafts.map(c => c.craft);
    if (crafts.length === 0) return res.json([]);

    const grouped = await prisma.craftRecommendation.groupBy({
      by: ["craft"],
      where: { targetUserId, craft: { in: crafts } },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map(g => [g.craft, g._count._all]));

    const { viewerType, viewerId } = req.query as { viewerType?: string; viewerId?: unknown };
    let mine = new Set<Craft>();
    if (
      userId && typeof viewerId === "string" && isValidParticipantType(viewerType) &&
      (await canActAs(userId, viewerType, viewerId))
    ) {
      const rows = await prisma.craftRecommendation.findMany({
        where: { targetUserId, craft: { in: crafts }, recommenderType: viewerType, recommenderId: viewerId },
        select: { craft: true },
      });
      mine = new Set(rows.map(r => r.craft));
    }

    res.json(crafts.map(craft => ({
      craft,
      count: counts.get(craft) ?? 0,
      recommendedByViewer: mine.has(craft),
    })));
  } catch (error: any) {
    fail(res, error, "recommendations");
  }
};
