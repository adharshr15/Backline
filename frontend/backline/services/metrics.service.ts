import api from './api';

export type ProfileKind = 'user' | 'band' | 'venue';

export interface TopShow {
    id: string;
    label: string;
    date: string;
    rsvpCount: number;
}

export interface ProfileMetrics {
    followers: number;
    following: number;
    showsHosted: number;
    totalRsvps: number;
    totalReposts: number;
    showsAttending: number;
    posts: number;
    likesReceived: number;
    listings: number;
    scenesFollowed: number;
    topShow: TopShow | null;
}

export const getProfileMetrics = async (
    type: ProfileKind,
    id: string
): Promise<ProfileMetrics> => {
    const response = await api.get(`/metrics/${type}/${id}`);
    return response.data;
};
