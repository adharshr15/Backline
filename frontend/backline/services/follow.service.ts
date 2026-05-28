import api from './api';

type FollowerType = 'USER' | 'BAND' | 'VENUE';
type AccountKind = 'user' | 'band' | 'venue';

export const follow = async (
    followerType: FollowerType,
    followeeType: FollowerType,
    followeeId: string,
    followerBandId?: string,
    followerVenueId?: string
) => {
    const response = await api.post('/follows', {
        followerType, followeeType, followeeId, followerBandId, followerVenueId
    });
    return response.data;
};

export const unfollow = async (
    followerType: FollowerType,
    followeeType: FollowerType,
    followeeId: string,
    followerBandId?: string,
    followerVenueId?: string
) => {
    const response = await api.delete('/follows', {
        data: { followerType, followeeType, followeeId, followerBandId, followerVenueId }
    });
    return response.data;
};

export const checkFollowing = async (
    followerType: FollowerType,
    followeeType: FollowerType,
    followeeId: string,
    followerBandId?: string,
    followerVenueId?: string
): Promise<boolean> => {
    const params: Record<string, string> = { followerType, followeeType, followeeId };
    if (followerBandId) params.followerBandId = followerBandId;
    if (followerVenueId) params.followerVenueId = followerVenueId;

    const response = await api.get('/follows/check', { params });
    return response.data.isFollowing;
};

export const getFollowers = async (type: AccountKind, id: string) => {
    const response = await api.get(`/follows/followers/${type}/${id}`);
    return response.data;
};

export const getFollowing = async (type: AccountKind, id: string) => {
    const response = await api.get(`/follows/following/${type}/${id}`);
    return response.data;
};
