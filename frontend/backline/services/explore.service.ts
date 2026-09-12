import api from './api';

/**
 * The Explore feed is a LIST of section descriptors, not a fixed object. The
 * client renders sections.map(...) and knows nothing about which sections exist,
 * so adding "Texas Shoegaze" later is a backend-only change.
 */

export type SectionKind = 'SHOW' | 'PROFILE' | 'SCENE' | 'POSTS';
export type ItemType = 'SHOW' | 'BAND' | 'VENUE' | 'USER' | 'SCENE' | 'POST';

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
    // Posts: name/profileImageUrl are the owner's, subtitle is the caption.
    url?: string;
    mediaType?: 'PHOTO' | 'VIDEO';
    showId?: string | null;
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
    // Continues the post grids past the last rail via getExplorePosts. Null when
    // every ranked post is already in `sections`.
    postsCursor: string | null;
}

export type ProfileType = 'user' | 'band' | 'venue';

type FeedOpts = {
    profileId: string;
    profileType: ProfileType;
    city?: string | null;
    state?: string | null;
    lat?: number;
    lng?: number;
    radiusKm?: number;
};

/** The profile + location params /explore and /explore/posts share. */
const feedParams = (opts: FeedOpts) => {
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
    return params;
};

export const getExplore = async (opts: FeedOpts & { limit?: number }): Promise<ExploreResponse> => {
    const params = feedParams(opts);
    if (opts.limit !== undefined) params.limit = opts.limit;

    const res = await api.get('/explore', { params });
    return res.data;
};

/**
 * The next page of ranked posts. Pass the same profile and location as the
 * /explore call the cursor came from; a null nextCursor means the end.
 */
export const getExplorePosts = async (
    opts: FeedOpts & { cursor: string; limit?: number },
): Promise<{ items: ExploreItem[]; nextCursor: string | null }> => {
    const params: Record<string, string | number> = { ...feedParams(opts), cursor: opts.cursor };
    if (opts.limit !== undefined) params.limit = opts.limit;

    const res = await api.get('/explore/posts', { params });
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
