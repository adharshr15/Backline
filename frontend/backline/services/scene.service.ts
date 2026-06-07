import api from "./api";

export interface SceneFollow {
    id: string;
    city: string;
    state: string;
    country?: string | null;
    followerId: string;
    followerType: string;
    createdAt: string;
}

export interface SceneCity {
    city: string;
    state: string;
    lat: number;
    lng: number;
    venueCount: number;
}

export const getFollowedScenes = async (
    followerId: string,
    followerType: 'user' | 'band' | 'venue'
): Promise<SceneFollow[]> => {
    const res = await api.get('/scenes/following', { params: { followerId, followerType } });
    return res.data;
};

export const followScene = async (
    city: string,
    state: string,
    followerId: string,
    followerType: 'user' | 'band' | 'venue',
    country?: string
): Promise<void> => {
    await api.post('/scenes/follow', { city, state, country, followerId, followerType });
};

export const unfollowScene = async (
    city: string,
    state: string,
    followerId: string,
    followerType: 'user' | 'band' | 'venue'
): Promise<void> => {
    await api.delete('/scenes/follow', { data: { city, state, followerId, followerType } });
};

export const getSceneCities = async (): Promise<SceneCity[]> => {
    const res = await api.get('/scenes/cities');
    return res.data;
};
