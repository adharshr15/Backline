import axios from 'axios';

export const BASE_URL = 'http://192.168.1.113:3000'

const api = axios.create({
  baseURL: BASE_URL
})

export const setAuthToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export default api;