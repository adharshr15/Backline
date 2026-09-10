import { Alert } from "react-native";
import api from "./api";

export interface BandSummary {
    id: string;
    name: string;
    genres?: { slug: string; name: string }[];
    city?: string | null;
    state?: string | null;
    profileImageUrl?: string | null;
}

export const getBandsByFilter = async (opts: {
    genre?: string;
    city?: string;
    state?: string;
    limit?: number;
    excludeId?: string;
}): Promise<BandSummary[]> => {
    const params: Record<string, string | number> = { limit: opts.limit ?? 10 };
    if (opts.genre) params.genre = opts.genre;
    if (opts.city)  params.city  = opts.city;
    if (opts.state) params.state = opts.state;
    const response = await api.get('/bands', { params });
    const data: BandSummary[] = response.data;
    return opts.excludeId ? data.filter(b => b.id !== opts.excludeId) : data;
};

export const createBand = async (formData: FormData) => {
    try {
        const response = await api.post('/bands', formData);
        return response.data;
    } catch (error: any) {
        return Alert.alert("Error", "Couldn't create band.")
    }
}

export const updateBand = async (bandId: string, data: {
    name?: string;
    /** Genre slugs, primary first. Omit to leave them alone; [] clears them. */
    genres?: string[];
    bio?: string;
    city?: string;
    state?: string;
    country?: string;
    profileImage?: string | null;
    headerImage?: string | null;
}) => {
    const formData = new FormData();

    if (data.name) formData.append('name', data.name);
    // JSON-encoded: FormData cannot carry an array, and [] must stay expressible.
    if (data.genres) formData.append('genres', JSON.stringify(data.genres));
    if (data.bio) formData.append('bio', data.bio);
    if (data.city) formData.append('city', data.city);
    if (data.state) formData.append('state', data.state);
    if (data.country) formData.append('country', data.country);

    if (data.profileImage?.startsWith('file://')) {
        formData.append('profileImage', {
            uri: data.profileImage,
            name: 'profile.jpg',
            type: 'image/jpeg',
        } as any);
    }

    if (data.headerImage?.startsWith('file://')) {
        formData.append('headerImage', {
            uri: data.headerImage,
            name: 'header.jpg',
            type: 'image/jpeg',
        } as any);
    }

    const response = await api.put(`/bands/${bandId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
};