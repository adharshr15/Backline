import api from './api'
import { Band } from '@/context/AuthContext';

export interface ShowVenue {
    id: string;
    name: string;
    city?: string;
    state?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
}

export interface ShowBandEntry {
    id: string;
    bandId: string;
    showId: string;
    role: string;
    band: Band;
}

export interface ShowInviteEntry {
    id: string;
    showId: string;
    bandId?: string | null;
    venueId?: string | null;
    status: string;
    createdAt: string;
    show: {
        id: string;
        date: string;
        city: string;
        state: string;
        country: string;
        posterUrl?: string | null;
    };
    band?: { id: string; name: string; profileImageUrl?: string | null } | null;
    venue?: { id: string; name: string; profileImageUrl?: string | null } | null;
}

export interface Show {
    id: string;
    posterUrl?: string;
    venue: ShowVenue | null;
    venueName?: string | null;
    venueAddress?: string | null;
    bandLineup?: string | null;
    city: string;
    state: string;
    country: string;
    status: string;
    notes?: string;
    date: string;
    doors: string;
    ticketsUrl?: string;
    bands: ShowBandEntry[];
    createdByUserId?: string;
    createdByBandId?: string;
    createdByVenueId?: string;
    repostedByUsers: { id: string }[];
    repostedByBands: { id: string }[];
    repostedByVenues: { id: string }[];
    rsvpUsers: { id: string }[];
    rsvpBands: { id: string }[];
    rsvpVenues: { id: string }[];
}

export interface CreateShowData {
    date: string;
    city: string;
    state: string;
    country: string;
    doors: string;
    status?: string;
    ticketsUrl?: string;
    notes?: string;
    venueId?: string;
    venueName?: string;
    venueAddress?: string;
    bandIds?: string[];       // create: all bands to invite
    addBandIds?: string[];    // edit: new bands to invite
    removeBandIds?: string[]; // edit: bands to remove from show
    bandLineup?: string;
    creatorUserId?: string;
    creatorBandId?: string;
    creatorVenueId?: string;
    posterImage?: { uri: string; name: string; type: string };
}

export const getShowsByProfile = async (
    profileType: 'band' | 'venue' | 'user',
    profileId: string,
    past = false
): Promise<Show[]> => {
    const params: Record<string, string> = { past: String(past) };
    if (profileType === 'band') params.bandId = profileId;
    else if (profileType === 'venue') params.venueId = profileId;
    else params.userId = profileId;

    const response = await api.get('/shows', { params });
    return response.data;
};

export const updateShow = async (id: string, data: Omit<CreateShowData, 'creatorUserId' | 'creatorBandId' | 'creatorVenueId'>): Promise<Show> => {
    const formData = new FormData();
    const { posterImage, bandIds, addBandIds, removeBandIds, ...rest } = data;

    Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value as string);
        }
    });

    (addBandIds ?? []).forEach(bid => formData.append('addBandIds[]', bid));
    (removeBandIds ?? []).forEach(bid => formData.append('removeBandIds[]', bid));

    if (posterImage) {
        formData.append('posterImage', posterImage as any);
    }

    const response = await api.put(`/shows/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const getFeedShows = async (
    followerType: 'user' | 'band' | 'venue',
    followerId: string
): Promise<Show[]> => {
    const response = await api.get('/shows/feed', { params: { followerType, followerId } });
    return response.data;
};

export const getRsvpShows = async (
    profileType: 'user' | 'band' | 'venue',
    profileId: string
): Promise<Show[]> => {
    const response = await api.get('/shows/rsvp', { params: { profileType, profileId } });
    return response.data;
};

export const rsvpShow = async (
    showId: string,
    rsvpType: 'user' | 'band' | 'venue',
    rsvpBandId?: string,
    rsvpVenueId?: string
): Promise<void> => {
    await api.post(`/shows/${showId}/rsvp`, { rsvpType, rsvpBandId, rsvpVenueId });
};

export const unrsvpShow = async (
    showId: string,
    rsvpType: 'user' | 'band' | 'venue',
    rsvpBandId?: string,
    rsvpVenueId?: string
): Promise<void> => {
    await api.delete(`/shows/${showId}/rsvp`, { data: { rsvpType, rsvpBandId, rsvpVenueId } });
};

export const repostShow = async (
    showId: string,
    reposterType: 'user' | 'band' | 'venue',
    reposterBandId?: string,
    reposterVenueId?: string
): Promise<void> => {
    await api.post(`/shows/${showId}/repost`, { reposterType, reposterBandId, reposterVenueId });
};

export const unrepostShow = async (
    showId: string,
    reposterType: 'user' | 'band' | 'venue',
    reposterBandId?: string,
    reposterVenueId?: string
): Promise<void> => {
    await api.delete(`/shows/${showId}/repost`, { data: { reposterType, reposterBandId, reposterVenueId } });
};

export const deleteShow = async (showId: string): Promise<void> => {
    await api.delete(`/shows/${showId}`);
};

export const leaveShow = async (showId: string, bandId?: string, venueId?: string): Promise<void> => {
    await api.delete(`/shows/${showId}/leave`, { data: { bandId, venueId } });
};

export const getMyBandShowInvites = async (): Promise<ShowInviteEntry[]> => {
    const response = await api.get('/bands/show-invites');
    return response.data;
};

export const getMyVenueShowInvites = async (): Promise<ShowInviteEntry[]> => {
    const response = await api.get('/venues/show-invites');
    return response.data;
};

export const respondToBandShowInvite = async (inviteId: string, action: 'ACCEPT' | 'DECLINE'): Promise<void> => {
    await api.post(`/bands/show-invites/${inviteId}/respond`, { action });
};

export const respondToVenueShowInvite = async (inviteId: string, action: 'ACCEPT' | 'DECLINE'): Promise<void> => {
    await api.post(`/venues/shows/invites/${inviteId}/respond`, { action });
};

export const searchBands = async (query: string): Promise<{ id: string; name: string; city?: string; profileImageUrl?: string }[]> => {
    const response = await api.get('/bands', { params: { search: query, limit: 10 } });
    return response.data;
};

export const searchVenues = async (query: string): Promise<{ id: string; name: string; city?: string; profileImageUrl?: string }[]> => {
    const response = await api.get('/venues', { params: { search: query, limit: 10 } });
    return response.data;
};

export const getShowsByLocation = async (city: string, state: string, dateRange?: string): Promise<Show[]> => {
    const params: Record<string, string> = { city, state };
    if (dateRange) params.dateRange = dateRange;
    const response = await api.get('/shows', { params });
    return response.data;
};

export const createShow = async (data: CreateShowData): Promise<Show> => {
    const formData = new FormData();
    const { posterImage, bandIds, ...rest } = data;

    Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value as string);
        }
    });

    if (bandIds?.length) {
        bandIds.forEach(id => formData.append('bandIds[]', id));
    }

    if (posterImage) {
        formData.append('posterImage', posterImage as any);
    }

    if (!rest.status) {
        formData.append('status', 'CONFIRMED');
    }

    const response = await api.post('/shows', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};
