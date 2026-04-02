import api from './api';

// Fetch all bands and venues logged in user belongs to 
export const getMyProfiles = async () => {
    try {
        const response = await api.get('/users/me/profiles');
        return response.data;
    }
    catch (error: any) {
        console.error('Error fetching profiles', error);
    }
    
}