import api from './api';

// Fetch all bands and venues logged in user belongs to 
export const getMyProfiles = async () => {
    const response = await api.get('/users/me/profiles');
    return response.data;
}