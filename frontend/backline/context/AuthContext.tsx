/* 
    Stores logged-in user ids and tokens globally so any screen can access
*/

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store';
import api from '@/services/api';


export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    accountType: string;
    bio?: string;
    city?: string;
    state?: string;
    country?: string;
    profileImageUrl?: string;
    headerImageUrl?: string;
    bandMemberships?: BandMembership[];
    venueReps?: VenueRep[];
}

type BandMembership = {
  id: string;
  bandId: string;
  userId: string;
  role: string;
  band: Band;
};

type VenueRep = {
  id: string;
  venueId: string;
  userId: string;
  role: string;
  venue: Venue;
};

export interface Band {
    id: string;
    name: string;
    genre?: string;
    city?: string;
    state?: string;
    country?: string;
    profileImageUrl?: string;
    headerImageUrl?: string;
    bio?: string;
    accountType: 'BAND';
}

export interface Venue {
    id: string;
    name: string;
    city?: string;
    state?: string;
    country?: string;
    capacity?: string;
    address?: string;
    contactEmail?: string;
    profileImageUrl?: string;
    headerImageUrl?: string;
    bio?: string;
    accountType: 'VENUE';
}

export type AccountType = "USER" | "BAND" | "VENUE"
export type ActiveProfile = User | Band | Venue;

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    activeProfile: ActiveProfile | null;
    setActiveProfile: (profile: ActiveProfile) => void;
    saveAuth: (user: User, token: string) => Promise<void>;
    clearAuth: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(null);

    // Check if token is saved on device
    useEffect(() => {
        const restoreSession = async () => {
            try {
                // Check for saved token
                const savedToken = await SecureStore.getItemAsync('token');

                if (savedToken) {
                    // Fetch current user using saved token
                    api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
                    const response = await api.get('/auth/me');
                    setUser(response.data);
                    setActiveProfile(response.data);
                    setToken(savedToken);
                }
            }
            catch (error) {
                // Clear invalid/expired token
                await SecureStore.deleteItemAsync('token');
            }
            finally {
                // Done checking, render app
                setLoading(false);
            }
        };

        restoreSession();
    }, []);

    // Save authorization info for user
    const saveAuth = async (user: User, token: string) => {
        try {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await SecureStore.setItemAsync('token', token);
            setToken(token);
            // Fetch full user (with bandMemberships/venueReps) so account switcher works immediately
            const response = await api.get('/auth/me');
            const fullUser: User = response.data;
            setUser(fullUser);
            setActiveProfile(fullUser);
        }
        catch (error: any) {
            return error;
        }
    };

    // Delete authorization info for user
    const clearAuth = async () => {
        setUser(null);
        setToken(null);
        setActiveProfile(null);
        delete api.defaults.headers.common['Authorization'];
        await SecureStore.deleteItemAsync('token')
    }

    const refreshUser = async () => {
        const response = await api.get('/auth/me');
        setUser(response.data);
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, activeProfile, setActiveProfile, saveAuth, clearAuth, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}

// Hook to allow use of auth anywhere
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}