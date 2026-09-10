import api from './api';

export interface Genre {
    id: string;
    slug: string;
    name: string;
    sortOrder: number;
    parentSlug: string | null;
    children?: Genre[];
}

/**
 * GET /genres — the seeded taxonomy the genre chips render from.
 *
 *   sceneSlug  only genres bands in that scene actually carry
 *   flat       one flat list instead of roots with nested children
 */
export const getGenres = async (opts: {
    sceneSlug?: string | null;
    flat?: boolean;
} = {}): Promise<Genre[]> => {
    const params: Record<string, string> = {};
    if (opts.sceneSlug) params.sceneSlug = opts.sceneSlug;
    if (opts.flat) params.flat = '1';

    const res = await api.get('/genres', { params });
    return res.data?.genres ?? [];
};
