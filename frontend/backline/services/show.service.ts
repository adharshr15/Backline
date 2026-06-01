import api from './api'
import { Band } from '@/context/AuthContext';

export interface ShowVenue {
    id: string;
    name: string;
    city?: string;
    state?: string;
    address?: string;
}

export interface ShowBandEntry {
    id: string;
    bandId: string;
    showId: string;
    role: string;
    band: Band;
}

export interface Show {
    id: string;
    posterUrl?: string;
    venue: ShowVenue | null;
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
    bandIds?: string[];
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

    const response = await api.put(`/shows/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
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
