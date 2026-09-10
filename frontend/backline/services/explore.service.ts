import api from './api';

/**
 * The Explore feed is a LIST of section descriptors, not a fixed object. The
 * client renders sections.map(...) and knows nothing about which sections exist,
 * so adding "Texas Shoegaze" later is a backend-only change.
 */

export type SectionKind = 'SHOW' | 'PROFILE' | 'SCENE';
export type ItemType = 'SHOW' | 'BAND' | 'VENUE' | 'USER' | 'SCENE';

export interface ExploreGenre {
    slug: string;
    name: string;
}

export interface ExploreCraft {
    craft: string;
    forHire: boolean;
    headline?: string | null;
}

export interface SceneCounts {
    bands: number;
    venues: number;
    upcomingShows: number;
    followers: number;
    people?: number;
}

export interface ExploreItem {
    id: string;
    type: ItemType;
    accountType: string | null;
    name: string;
    subtitle: string;
    profileImageUrl: string | null;
    // Additive, per type.
    slug?: string;
    sceneSlug?: string;
    city?: string | null;
    state?: string | null;
    date?: string;
    venueName?: string | null;
    genres?: ExploreGenre[];
    crafts?: ExploreCraft[];
    counts?: SceneCounts;
}

export interface SeeMore {
    path: string;
    params: Record<string, string>;
}

export interface ExploreSection {
    key: string;
    title: string;
    kind: SectionKind;
    seeMore: SeeMore;
    items: ExploreItem[];
}

export interface ExploreLocation {
    city: string;
    state: string;
    country: string;
    scene: { id: string; slug: string; name: string };
    source: 'query' | 'coords' | 'profile';
}

export interface ExploreResponse {
    // Null when nothing resolved. Location sections are then omitted entirely
    // rather than returned empty, so the client never renders an empty rail.
    location: ExploreLocation | null;
    sections: ExploreSection[];
}

export type ProfileType = 'user' | 'band' | 'venue';

export const getExplore = async (opts: {
    profileId: string;
    profileType: ProfileType;
    city?: string | null;
    state?: string | null;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
}): Promise<ExploreResponse> => {
    const params: Record<string, string | number> = {
        profileId: opts.profileId,
        profileType: opts.profileType,
    };
    // city and state must be supplied together or not at all.
    if (opts.city && opts.state) {
        params.city = opts.city;
        params.state = opts.state;
    } else if (opts.lat !== undefined && opts.lng !== undefined) {
        params.lat = opts.lat;
        params.lng = opts.lng;
        if (opts.radiusKm !== undefined) params.radiusKm = opts.radiusKm;
    }
    if (opts.limit !== undefined) params.limit = opts.limit;

    const res = await api.get('/explore', { params });
    return res.data;
};

/**
 * Fetch one page of a section's "see more" target.
 *
 * The seeMore paths span four response envelopes -- /bands, /venues and /shows
 * return bare arrays, /scenes/:slug/* returns { items }, /users/discover returns
 * { people }, /scenes returns { scenes } -- so the unwrap is deliberately
 * permissive. That is what keeps a section the backend adds later working here
 * without a frontend change.
 */
export const fetchSection = async (
    path: string,
    params: Record<string, string> = {},
    page = 1,
    limit = 30,
): Promise<{ items: any[]; hasMore: boolean }> => {
    const res = await api.get(path, { params: { ...params, page, limit } });
    const data = res.data;

    const items: any[] = Array.isArray(data)
        ? data
        : data?.items ?? data?.people ?? data?.scenes ?? data?.results ?? [];

    const hasMore =
        typeof data?.hasMore === 'boolean' ? data.hasMore : items.length === limit;

    return { items, hasMore };
};
