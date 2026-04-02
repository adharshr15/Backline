import axios from 'axios';
import { BASE_URL } from './api';

export const publicApi = axios.create({
    baseURL: BASE_URL,
});

export default publicApi;