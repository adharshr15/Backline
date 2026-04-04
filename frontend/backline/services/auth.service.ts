/* 
    Holds register/login api calls
*/

import api from './api'

interface loginReq {
    username?: string
    email?: string
    password: string
}

export const registerUser = async (formData: FormData) => {
    delete api.defaults.headers.common['Authorization'];

    const response = await api.post('/auth/register', formData)

    return response.data;
}

export const loginUser = async (req: loginReq) => {
    if (!req.email && !req.username) {
        throw new Error('Email or Username is required');
    }

    const response = await api.post('/auth/login', req)
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