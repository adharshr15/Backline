import { Alert } from "react-native";
import api from "./api";

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
    genre?: string;
    bio?: string;
    city?: string;
    state?: string;
    country?: string;
    profileImage?: string | null;
    headerImage?: string | null;
}) => {
    const formData = new FormData();

    if (data.name) formData.append('name', data.name);
    if (data.genre) formData.append('genre', data.genre);
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