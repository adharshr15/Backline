import api from './api'
import { Band } from '@/context/AuthContext';
import { AccountType } from '@/context/AuthContext';

export interface Show {
    id: string;
    posterUrl?: string;
    venue: string;
    city: string;
    state: string;
    country: string;
    status: string;
    notes?: string;
    date: string;
    doors: string;
    ticketUrl?: string;
    bands: Band[];
    creatorUserId?: string
    creatorBandId?: string
    creatorVenueId?: string
};

// export const createShow = async (data: Show, accountType: AccountType) {
//     const formData
// }