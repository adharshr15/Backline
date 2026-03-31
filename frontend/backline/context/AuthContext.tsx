/* 
    Stores logged-in user ids and tokens globally so any screen can access
*/

import { createContext, useContext, useState, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'

interface User {
    id: string;
    name: string;
    username: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    saveAuth: (user: User, token: string) => Promise<void>;
    clearAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    // Save authorization info for user
    const saveAuth = async (user: User, token: string) => {
        setUser(user);
        setToken(token);
        await SecureStore.setItemAsync('token', token);
    };

    // Delete authorization info for user
    const clearAuth = async () => {
        setUser(null);
        setToken(null);
        await SecureStore.deleteItemAsync('token')
    }

    return (
        <AuthContext.Provider value={{ user, token, saveAuth, clearAuth }}>
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