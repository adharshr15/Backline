import api from './api';

export interface ShowMedia {
    id: string;
    showId: string;
    url: string;
    type: 'PHOTO' | 'VIDEO';
    uploaderUserId: string;
    contributorType: string;
    contributorId: string;
    createdAt: string;
}

export const getShowMedia = async (showId: string): Promise<ShowMedia[]> => {
    const response = await api.get(`/shows/${showId}/media`);
    return response.data;
};

export const addShowMedia = async (
    showId: string,
    file: { uri: string; name: string; type: string },
    mediaType: 'PHOTO' | 'VIDEO',
    contributorType: 'USER' | 'BAND' | 'VENUE',
    contributorId: string,
): Promise<ShowMedia> => {
    const formData = new FormData();
    formData.append('media', file as any);
    formData.append('type', mediaType);
    formData.append('contributorType', contributorType);
    formData.append('contributorId', contributorId);

    const response = await api.post(`/shows/${showId}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const deleteShowMedia = async (mediaId: string): Promise<void> => {
    await api.delete(`/shows/media/${mediaId}`);
};
