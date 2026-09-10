import api from "./api";
import type { ExploreCraft, ExploreGenre, SceneCounts } from "./explore.service";

export type FollowerType = 'user' | 'band' | 'venue';

export interface SceneRef {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string;
    country?: string | null;
    imageUrl?: string | null;
}

export interface SceneFollow {
    id: string;
    city: string;
    state: string;
    country?: string | null;
    followerId: string;
    followerType: string;
    createdAt: string;
    // Additive: the joined Scene, which carries the slug.
    sceneId?: string;
    scene?: SceneRef;
}

export interface SceneCity {
    city: string;
    state: string;
    lat: number;
    lng: number;
    venueCount: number;
    slug?: string;
}

export interface SceneSummary {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
    isCurated: boolean;
    counts: SceneCounts;
    distanceKm?: number;
}

export interface SceneTopGenre {
    slug: string;
    name: string;
    bandCount: number;
}

export interface SceneDetail extends SceneSummary {
    bio?: string | null;
    headerImageUrl?: string | null;
    topGenres: SceneTopGenre[];
}

export interface SceneBand {
    id: string;
    name: string;
    city?: string | null;
    state?: string | null;
    profileImageUrl?: string | null;
    accountType: string;
    genres: ExploreGenre[];
}

export interface SceneVenue {
    id: string;
    name: string;
    city?: string | null;
    state?: string | null;
    capacity?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    profileImageUrl?: string | null;
    accountType: string;
}

export interface ScenePerson {
    id: string;
    username: string;
    name: string;
    accountType: string;
    city?: string | null;
    state?: string | null;
    profileImageUrl?: string | null;
    crafts: ExploreCraft[];
}

interface Paginated<T> {
    items: T[];
    page: number;
    limit: number;
    hasMore: boolean;
}

const page = <T>(res: { data: any }): Paginated<T> => ({
    items: res.data?.items ?? [],
    page: res.data?.page ?? 1,
    limit: res.data?.limit ?? 0,
    hasMore: res.data?.hasMore ?? false,
});

// ---- Follow graph -------------------------------------------------------
// These four keep their shipped signatures: home/index.tsx, marketplace/index.tsx
// and NearbyShowsSection all call them.

export const getFollowedScenes = async (
    followerId: string,
    followerType: FollowerType
): Promise<SceneFollow[]> => {
    const res = await api.get('/scenes/following', { params: { followerId, followerType } });
    return res.data;
};

export const followScene = async (
    city: string,
    state: string,
    followerId: string,
    followerType: FollowerType,
    country?: string
): Promise<void> => {
    await api.post('/scenes/follow', { city, state, country, followerId, followerType });
};

export const unfollowScene = async (
    city: string,
    state: string,
    followerId: string,
    followerType: FollowerType
): Promise<void> => {
    await api.delete('/scenes/follow', { data: { city, state, followerId, followerType } });
};

/** @deprecated Use getScenes(), which paginates and carries full counts. */
export const getSceneCities = async (): Promise<SceneCity[]> => {
    const res = await api.get('/scenes/cities');
    return res.data;
};

export const followSceneBySlug = async (
    slug: string,
    followerId: string,
    followerType: FollowerType
): Promise<void> => {
    await api.post('/scenes/follow', { slug, followerId, followerType });
};

export const unfollowSceneBySlug = async (
    slug: string,
    followerId: string,
    followerType: FollowerType
): Promise<void> => {
    await api.delete('/scenes/follow', { data: { slug, followerId, followerType } });
};

/** One request instead of fetching the whole follow list and scanning it. */
export const getSceneFollowState = async (
    slug: string,
    followerId: string,
    followerType: FollowerType
): Promise<boolean> => {
    const res = await api.get(`/scenes/${slug}/following`, { params: { followerId, followerType } });
    return res.data?.isFollowing === true;
};

// ---- Scene discovery and detail -----------------------------------------

export const getScenes = async (opts: {
    q?: string;
    state?: string;
    curatedOnly?: boolean;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    sort?: 'activity' | 'name' | 'distance';
    page?: number;
    limit?: number;
} = {}): Promise<{ scenes: SceneSummary[]; hasMore: boolean }> => {
    const params: Record<string, string | number | boolean> = {};
    if (opts.q) params.q = opts.q;
    if (opts.state) params.state = opts.state;
    if (opts.curatedOnly) params.curatedOnly = true;
    if (opts.lat !== undefined && opts.lng !== undefined) {
        params.lat = opts.lat;
        params.lng = opts.lng;
        if (opts.radiusKm !== undefined) params.radiusKm = opts.radiusKm;
    }
    if (opts.sort) params.sort = opts.sort;
    if (opts.page) params.page = opts.page;
    if (opts.limit) params.limit = opts.limit;

    const res = await api.get('/scenes', { params });
    return { scenes: res.data?.scenes ?? [], hasMore: res.data?.hasMore ?? false };
};

export const getScene = async (slug: string): Promise<SceneDetail> => {
    const res = await api.get(`/scenes/${slug}`);
    return res.data;
};

/**
 * Same payload as getScene. Exists because most shipped callers push a scene
 * route with { city, state } rather than a slug.
 */
export const getSceneByLocation = async (city: string, state: string): Promise<SceneDetail> => {
    const res = await api.get('/scenes/by-location', { params: { city, state } });
    return res.data;
};

// ---- Scene contents -----------------------------------------------------

export const getSceneBands = async (
    slug: string,
    opts: { genre?: string; q?: string; page?: number; limit?: number } = {}
): Promise<Paginated<SceneBand>> =>
    page<SceneBand>(await api.get(`/scenes/${slug}/bands`, { params: opts }));

export const getSceneVenues = async (
    slug: string,
    opts: { q?: string; minCapacity?: number; maxCapacity?: number; page?: number; limit?: number } = {}
): Promise<Paginated<SceneVenue>> =>
    page<SceneVenue>(await api.get(`/scenes/${slug}/venues`, { params: opts }));

export const getScenePeople = async (
    slug: string,
    opts: { craft?: string; forHire?: boolean; page?: number; limit?: number } = {}
): Promise<Paginated<ScenePerson>> =>
    page<ScenePerson>(await api.get(`/scenes/${slug}/people`, { params: opts }));

export const getSceneShows = async (
    slug: string,
    opts: { dateRange?: string; genre?: string; past?: boolean; page?: number; limit?: number } = {}
): Promise<Paginated<any>> =>
    page<any>(await api.get(`/scenes/${slug}/shows`, { params: opts }));
