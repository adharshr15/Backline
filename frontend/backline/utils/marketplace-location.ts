import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'marketplace.location';
const HISTORY_KEY = 'marketplace.location.history';
const HISTORY_MAX = 8;

export interface SavedLocation {
    city: string;
    state: string | null;
}

const sameLoc = (a: SavedLocation, b: SavedLocation) =>
    a.city.toLowerCase() === b.city.toLowerCase() &&
    (a.state ?? '').toLowerCase() === (b.state ?? '').toLowerCase();

export const getSavedLocation = async (): Promise<SavedLocation | null> => {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.city === 'string' && parsed.city.length > 0) {
            return { city: parsed.city, state: parsed.state ?? null };
        }
    } catch {}
    return null;
};

export const saveLocation = async (loc: SavedLocation): Promise<void> => {
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify({ city: loc.city, state: loc.state ?? null }));
    } catch {}
};

export const getHistory = async (): Promise<SavedLocation[]> => {
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .filter(p => p && typeof p.city === 'string' && p.city.length > 0)
                .map(p => ({ city: p.city, state: p.state ?? null }));
        }
    } catch {}
    return [];
};

// Prepend a location (deduped, most-recent-first, capped) and return the new list.
export const addToHistory = async (loc: SavedLocation): Promise<SavedLocation[]> => {
    const entry: SavedLocation = { city: loc.city, state: loc.state ?? null };
    const existing = await getHistory();
    const next = [entry, ...existing.filter(l => !sameLoc(l, entry))].slice(0, HISTORY_MAX);
    try {
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
    return next;
};

export const clearHistory = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(HISTORY_KEY);
    } catch {}
};
