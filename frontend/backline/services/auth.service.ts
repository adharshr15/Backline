/* 
    Holds register/login API calls
*/

import api from './api'

export const registerUser = async (formData: FormData) => {
    const response = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data'}
    })
    return response.data;
}

export const checkEmailUnique = async (email: string): Promise<boolean> => {
    const response = await api.get(`/auth/check-email?email=${email}`);
    return response.data.isUnique;
}

export const checkUsernameUnique = async (username: string): Promise<boolean> => {
    const response = await api.get(`/auth/check-username?username=${username}`);
    return response.data.isUnique;
}