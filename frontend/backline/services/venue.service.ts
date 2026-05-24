import { Alert } from "react-native";
import api from "./api";

export const createVenue = async (formData: FormData) => {
    try {
        const response = await api.post('/venues', formData);
        return response.data;
    } catch (error: any) {
        return Alert.alert("Error", "Couldn't create venue.")
    }
}

export const updateVenue = async (venueId: string, data: {
    name?: string;
    bio?: string;
    city?: string;
    state?: string;
    country?: string;
    address?: string;
    capacity?: string;
    contactEmail?: string;
    profileImage?: string | null;
    headerImage?: string | null;
}) => {
    const formData = new FormData();

    if (data.name) formData.append('name', data.name);
    if (data.bio) formData.append('bio', data.bio);
    if (data.city) formData.append('city', data.city);
    if (data.state) formData.append('state', data.state);
    if (data.country) formData.append('country', data.country);
    if (data.address) formData.append('address', data.address);
    if (data.capacity) formData.append('capacity', data.capacity);
    if (data.contactEmail) formData.append('contactEmail', data.contactEmail);

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

    const response = await api.put(`/venues/${venueId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
};