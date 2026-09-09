import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";

const genreSelect = {
  id: true,
  slug: true,
  name: true,
  sortOrder: true,
  parentId: true,
} as const;

type GenreRow = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  parentId: string | null;
};

const toFlat = (g: GenreRow, parentSlug: string | null) => ({
  id: g.id,
  slug: g.slug,
  name: g.name,
  sortOrder: g.sortOrder,
  parentSlug,
});

/**
 * GET /genres
 *
 * Public. The taxonomy the frontend genre chips render from, replacing their
 * hardcoded array.
 *
 *   ?flat=1        return one flat list instead of a nested tree
 *   ?sceneSlug=    only genres that bands in that scene actually carry
 *
 * One findMany for the tree; the sceneSlug variant adds a groupBy over that
 * scene's bands. Nesting happens in memory -- at ~150 rows that is free.
 */
export const getGenres = async (req: Request, res: Response) => {
    try {
        const flat = req.query.flat === "1" || req.query.flat === "true";
        const sceneSlug = (req.query.sceneSlug as string)?.trim();

        let genreIdFilter: string[] | undefined;

        if (sceneSlug) {
            const scene = await prisma.scene.findUnique({
                where: { slug: sceneSlug },
                select: { id: true },
            });

            // An unknown scene has no genres. Empty, not a 404 -- this is a filter,
            // not a resource lookup.
            if (!scene) return res.json({ genres: [] });

            const used = await prisma.bandGenre.groupBy({
                by: ["genreId"],
                where: { band: { sceneId: scene.id, deletedAt: null } },
            });
            genreIdFilter = used.map(u => u.genreId);

            if (genreIdFilter.length === 0) return res.json({ genres: [] });
        }

        const genres = await prisma.genre.findMany({
            where: {
                isActive: true,
                ...(genreIdFilter ? { id: { in: genreIdFilter } } : {}),
            },
            select: genreSelect,
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });

        const slugById = new Map(genres.map(g => [g.id, g.slug]));

        if (flat) {
            return res.json({
                genres: genres.map(g => toFlat(g, g.parentId ? slugById.get(g.parentId) ?? null : null)),
            });
        }

        // Nest children under their parent. A child whose parent was filtered out
        // (the sceneSlug case) is promoted to the top level rather than dropped.
        const childrenByParent = new Map<string, ReturnType<typeof toFlat>[]>();
        const roots: ReturnType<typeof toFlat>[] = [];

        for (const g of genres) {
            const parentSlug = g.parentId ? slugById.get(g.parentId) ?? null : null;
            const node = toFlat(g, parentSlug);

            if (g.parentId && parentSlug) {
                const siblings = childrenByParent.get(g.parentId) ?? [];
                siblings.push(node);
                childrenByParent.set(g.parentId, siblings);
            } else {
                roots.push(node);
            }
        }

        res.json({
            genres: roots.map(r => ({
                ...r,
                children: childrenByParent.get(r.id) ?? [],
            })),
        });
    } catch (error: any) {
        fail(res, error, "genre");
    }
};
